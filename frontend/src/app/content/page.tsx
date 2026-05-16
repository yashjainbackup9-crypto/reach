'use client';
import React, { useEffect, useState, useCallback } from 'react';
import { contentApi, Tone, GenerateToneResponse, ContentRewrite, ImageGenerationResponse, VideoGenerationResponse } from '@/lib/api';
import { useToast } from '@/components/Toast';
import { Wand2, RefreshCw, Trash2, Link, FileText, Copy, ChevronDown, ChevronUp, Pencil, Check, X, Image, Download, Video, ExternalLink, Plus } from 'lucide-react';
import { queuesApi } from '@/lib/api';

type Tab = 'generate' | 'rewrite' | 'image' | 'video' | 'tones';

export default function ContentPage() {
  const [tab, setTab] = useState<Tab>('generate');
  const [tones, setTones] = useState<Tone[]>([]);
  const [loadingTones, setLoadingTones] = useState(true);
  const { toast } = useToast();

  const fetchTones = useCallback(async () => {
    try { setTones(await contentApi.getTones()); }
    catch { toast('Failed to load tones', 'error'); }
    finally { setLoadingTones(false); }
  }, [toast]);

  useEffect(() => { fetchTones(); }, [fetchTones]);

  return (
    <div className="fade-in">
      <div className="topbar">
        <div>
          <h1 className="page-title">Content Studio</h1>
          <p className="page-subtitle">Generate AI brand tones, rewrite content, generate images, and manage your voice library.</p>
        </div>
      </div>

      <div className="pill-tabs" style={{ marginBottom: 32, width: 'fit-content' }}>
        {([
          ['generate', 'Generate Tone'],
          ['rewrite', 'Rewrite Content'],
          ['image', 'Generate Image'],
          ['video', 'Generate Video'],
          ['tones', `Saved Tones (${tones.length})`],
        ] as [Tab, string][]).map(([key, label]) => (
          <button key={key} className={`pill-tab ${tab === key ? 'active' : ''}`} onClick={() => setTab(key)}>{label}</button>
        ))}
      </div>

      {tab === 'generate' && <GenerateToneTab onSaved={fetchTones} />}
      {tab === 'rewrite'  && <RewriteTab tones={tones} />}
      {tab === 'image'    && <GenerateImageTab />}
      {tab === 'video'    && <GenerateVideoTab />}
      {tab === 'tones'    && <TonesTab tones={tones} loading={loadingTones} onDeleted={fetchTones} />}
    </div>
  );
}

/* ─── Generate Tone Tab ───────────────────────────────────────────────────── */
function GenerateToneTab({ onSaved }: { onSaved: () => void }) {
  const [type, setType] = useState<'instagram_link' | 'text'>('instagram_link');
  const [input, setInput] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<GenerateToneResponse | null>(null);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setResult(null);
    try {
      const res = await contentApi.generateTone({ type, input, name });
      setResult(res);
      onSaved();
      toast(`Tone "${res.saved.name}" generated and saved!`, 'success');
    } catch (err: any) {
      toast(err.message, 'error');
    } finally { setLoading(false); }
  };

  return (
    <div className="grid-2" style={{ alignItems: 'start' }}>
      <div className="card">
        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 6 }}>Generate a Brand Tone</h2>
        <p style={{ fontSize: 14, color: 'var(--color-muted)', marginBottom: 24 }}>
          Analyse an Instagram post or describe your brand to create a reusable tone prompt.
        </p>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Type selector */}
          <div className="form-group">
            <label className="form-label">Input type</label>
            <div style={{ display: 'flex', gap: 10 }}>
              {([['instagram_link', 'Instagram URL', Link], ['text', 'Text Description', FileText]] as [typeof type, string, any][]).map(([val, lbl, Icon]) => (
                <button key={val} type="button" onClick={() => setType(val)}
                  style={{
                    flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    padding: '12px 16px', borderRadius: 'var(--r-sm)',
                    border: `2px solid ${type === val ? 'var(--color-primary)' : 'var(--color-hairline)'}`,
                    background: type === val ? '#fff0f1' : 'var(--color-canvas)',
                    color: type === val ? 'var(--color-primary)' : 'var(--color-muted)',
                    fontWeight: 500, fontSize: 14, cursor: 'pointer', transition: 'all 0.15s',
                  }}>
                  <Icon size={16} />{lbl}
                </button>
              ))}
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">{type === 'instagram_link' ? 'Instagram post URL' : 'Brand description'}</label>
            <textarea className="textarea"
              placeholder={type === 'instagram_link' ? 'https://www.instagram.com/p/abc123/' : 'Describe your brand voice, style, and target audience…'}
              value={input} onChange={e => setInput(e.target.value)} required rows={4}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Tone name</label>
            <input className="input" placeholder="e.g. My Coffee Brand Voice" value={name} onChange={e => setName(e.target.value)} required />
          </div>

          <button className="btn-primary" type="submit" disabled={loading}>
            {loading ? <><div className="spinner" style={{ width: 18, height: 18, borderTopColor: '#fff' }} /> Generating…</> : <><Wand2 size={16} /> Generate Tone</>}
          </button>
        </form>
      </div>

      {/* Result */}
      {result ? (
        <div className="card fade-in">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <h3 style={{ fontSize: 16, fontWeight: 700 }}>✨ Tone Generated</h3>
            <span className="badge badge-success">Saved</span>
          </div>
          <div className="form-group" style={{ marginBottom: 16 }}>
            <label className="form-label">Tone name</label>
            <p style={{ fontSize: 15, fontWeight: 600 }}>{result.saved.name}</p>
          </div>
          <div className="form-group" style={{ marginBottom: 16 }}>
            <label className="form-label">Label</label>
            <p style={{ fontSize: 14, color: 'var(--color-body)' }}>{result.label}</p>
          </div>
          {result.caption && (
            <div className="form-group" style={{ marginBottom: 16 }}>
              <label className="form-label">Extracted caption</label>
              <p style={{ fontSize: 14, color: 'var(--color-body)', fontStyle: 'italic' }}>"{result.caption}"</p>
            </div>
          )}
          <div className="form-group">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label className="form-label">Tone prompt</label>
              <button className="btn-ghost btn-sm" onClick={() => { navigator.clipboard.writeText(result.tonePrompt); }}>
                <Copy size={13} /> Copy
              </button>
            </div>
            <div className="code-block" style={{ fontSize: 12 }}>{result.tonePrompt}</div>
          </div>
        </div>
      ) : (
        <div className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 300, textAlign: 'center' }}>
          <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#fff0f1', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
            <Wand2 size={28} color="var(--color-primary)" />
          </div>
          <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>Your tone will appear here</h3>
          <p style={{ fontSize: 14, color: 'var(--color-muted)' }}>Fill in the form and click Generate Tone</p>
        </div>
      )}
    </div>
  );
}

/* ─── Generate Image Tab ──────────────────────────────────────────────────── */
function GenerateImageTab() {
  const [inputType, setInputType] = useState<'prompt' | 'instagram'>('prompt');
  const [prompt, setPrompt] = useState('');
  const [instagramUrl, setInstagramUrl] = useState('');
  const [size, setSize] = useState<'1024x1024' | '1024x1536' | '1536x1024'>('1024x1024');
  const [quality, setQuality] = useState<'auto' | 'high' | 'medium' | 'low'>('auto');
  const [style, setStyle] = useState<'vivid' | 'natural'>('vivid');
  const [apiKey, setApiKey] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ImageGenerationResponse | null>(null);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (inputType === 'prompt' && !prompt.trim()) { toast('Enter a prompt', 'error'); return; }
    if (inputType === 'instagram' && !instagramUrl.trim()) { toast('Enter an Instagram URL', 'error'); return; }
    setLoading(true);
    setResult(null);
    try {
      const res = await contentApi.generateImage({
        ...(inputType === 'prompt' ? { prompt: prompt.trim() } : { instagramUrl: instagramUrl.trim(), prompt: prompt.trim() || undefined }),
        size,
        quality,
        style,
        ...(apiKey.trim() ? { apiKey: apiKey.trim() } : {}),
      });
      setResult(res);
      toast('Image generated!', 'success');
    } catch (err: any) {
      toast(err.message, 'error');
    } finally { setLoading(false); }
  };

  const handleDownload = () => {
    if (!result) return;
    const a = document.createElement('a');
    a.href = result.imageDataUrl;
    a.download = 'generated-image.png';
    a.click();
  };

  return (
    <div className="grid-2" style={{ alignItems: 'start' }}>
      <div className="card">
        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 6 }}>Generate AI Image</h2>
        <p style={{ fontSize: 14, color: 'var(--color-muted)', marginBottom: 24 }}>
          Create images using OpenAI gpt-image-1. Feed an Instagram post to auto-build the prompt from the caption.
        </p>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Input type */}
          <div className="form-group">
            <label className="form-label">Source</label>
            <div style={{ display: 'flex', gap: 10 }}>
              {([['prompt', 'Custom Prompt', Wand2], ['instagram', 'Instagram Post', Link]] as [typeof inputType, string, any][]).map(([val, lbl, Icon]) => (
                <button key={val} type="button" onClick={() => setInputType(val)}
                  style={{
                    flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    padding: '12px 16px', borderRadius: 'var(--r-sm)',
                    border: `2px solid ${inputType === val ? 'var(--color-primary)' : 'var(--color-hairline)'}`,
                    background: inputType === val ? '#fff0f1' : 'var(--color-canvas)',
                    color: inputType === val ? 'var(--color-primary)' : 'var(--color-muted)',
                    fontWeight: 500, fontSize: 14, cursor: 'pointer', transition: 'all 0.15s',
                  }}>
                  <Icon size={16} />{lbl}
                </button>
              ))}
            </div>
          </div>

          {inputType === 'instagram' && (
            <div className="form-group">
              <label className="form-label">Instagram post URL</label>
              <input className="input" placeholder="https://www.instagram.com/p/abc123/" value={instagramUrl} onChange={e => setInstagramUrl(e.target.value)} />
            </div>
          )}

          <div className="form-group">
            <label className="form-label">{inputType === 'instagram' ? 'Extra context (optional)' : 'Image prompt'}</label>
            <textarea className="textarea" rows={4}
              placeholder={inputType === 'instagram' ? 'Add style hints or extra context to the auto-generated prompt…' : 'Describe the image you want to generate…'}
              value={prompt} onChange={e => setPrompt(e.target.value)}
            />
          </div>

          {/* Size */}
          <div className="form-group">
            <label className="form-label">Size</label>
            <select className="select" value={size} onChange={e => setSize(e.target.value as any)}>
              <option value="1024x1024">1024 × 1024 (Square)</option>
              <option value="1024x1536">1024 × 1536 (Portrait)</option>
              <option value="1536x1024">1536 × 1024 (Landscape)</option>
            </select>
          </div>

          {/* Quality */}
          <div className="form-group">
            <label className="form-label">Quality</label>
            <select className="select" value={quality} onChange={e => setQuality(e.target.value as any)}>
              <option value="auto">Auto</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>

          {/* Style */}
          <div className="form-group">
            <label className="form-label">Style</label>
            <select className="select" value={style} onChange={e => setStyle(e.target.value as any)}>
              <option value="vivid">Vivid</option>
              <option value="natural">Natural</option>
            </select>
          </div>

          {/* Advanced (API key) */}
          <div>
            <button type="button" className="btn-ghost btn-sm" onClick={() => setShowAdvanced(v => !v)} style={{ marginBottom: 8 }}>
              {showAdvanced ? <ChevronUp size={14} /> : <ChevronDown size={14} />} Advanced
            </button>
            {showAdvanced && (
              <div className="form-group fade-in">
                <label className="form-label">OpenAI API key override</label>
                <input className="input" type="password" placeholder="sk-… (uses env default if blank)" value={apiKey} onChange={e => setApiKey(e.target.value)} />
              </div>
            )}
          </div>

          <button className="btn-primary" type="submit" disabled={loading}>
            {loading ? <><div className="spinner" style={{ width: 18, height: 18, borderTopColor: '#fff' }} /> Generating…</> : <><Image size={16} /> Generate Image</>}
          </button>
        </form>
      </div>

      {/* Result */}
      {result ? (
        <div className="card fade-in">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 style={{ fontSize: 16, fontWeight: 700 }}>Generated Image</h3>
            <button className="btn-ghost btn-sm" onClick={handleDownload}><Download size={14} /> Download</button>
          </div>
          <img
            src={result.imageDataUrl}
            alt="AI generated"
            style={{ width: '100%', borderRadius: 'var(--r-sm)', border: '1px solid var(--color-hairline)', marginBottom: 16 }}
          />
          {result.revisedPrompt && (
            <div className="form-group" style={{ marginBottom: 12 }}>
              <label className="form-label">Revised prompt</label>
              <p style={{ fontSize: 13, color: 'var(--color-muted)', fontStyle: 'italic' }}>{result.revisedPrompt}</p>
            </div>
          )}
          <div className="form-group">
            <label className="form-label">Prompt used</label>
            <div className="code-block" style={{ fontSize: 12 }}>{result.prompt}</div>
          </div>
          <p style={{ fontSize: 12, color: 'var(--color-muted)', marginTop: 8 }}>Model: {result.model}</p>
        </div>
      ) : (
        <div className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 360, textAlign: 'center' }}>
          <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#fff0f1', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
            <Image size={28} color="var(--color-primary)" />
          </div>
          <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>Your image will appear here</h3>
          <p style={{ fontSize: 14, color: 'var(--color-muted)' }}>Fill in the form and click Generate Image</p>
        </div>
      )}
    </div>
  );
}

/* ─── Rewrite Tab ─────────────────────────────────────────────────────────── */
function RewriteTab({ tones }: { tones: Tone[] }) {
  const [content, setContent] = useState('');
  const [toneName, setToneName] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ContentRewrite | null>(null);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await contentApi.rewrite({ content, toneName });
      setResult(res);
    } catch (err: any) {
      toast(err.message, 'error');
    } finally { setLoading(false); }
  };

  return (
    <div className="grid-2" style={{ alignItems: 'start' }}>
      <div className="card">
        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 6 }}>Rewrite with Tone</h2>
        <p style={{ fontSize: 14, color: 'var(--color-muted)', marginBottom: 24 }}>Apply a saved brand tone to rewrite any piece of content.</p>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div className="form-group">
            <label className="form-label">Select tone</label>
            {tones.length === 0 ? (
              <p style={{ fontSize: 14, color: 'var(--color-muted)', padding: '12px 0' }}>No tones yet — generate one first.</p>
            ) : (
              <div style={{ position: 'relative' }}>
                <select className="select" value={toneName} onChange={e => setToneName(e.target.value)} required>
                  <option value="">Choose a brand tone…</option>
                  {tones.map(t => <option key={t._id} value={t.name}>{t.name}</option>)}
                </select>
              </div>
            )}
          </div>
          <div className="form-group">
            <label className="form-label">Content to rewrite</label>
            <textarea className="textarea" placeholder="Paste the content you want to rewrite…" value={content} onChange={e => setContent(e.target.value)} required rows={6} />
          </div>
          <button className="btn-primary" type="submit" disabled={loading || tones.length === 0}>
            {loading ? <><div className="spinner" style={{ width: 18, height: 18, borderTopColor: '#fff' }} /> Rewriting…</> : <><RefreshCw size={16} /> Rewrite Content</>}
          </button>
        </form>
      </div>

      {result ? (
        <div className="card fade-in">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 style={{ fontSize: 16, fontWeight: 700 }}>✨ Rewritten Content</h3>
            <button className="btn-ghost btn-sm" onClick={() => navigator.clipboard.writeText(result.rewrittenContent)}>
              <Copy size={13} /> Copy
            </button>
          </div>
          <div style={{ fontSize: 14, color: 'var(--color-body)', lineHeight: 1.7, padding: '16px', background: 'var(--color-surface-soft)', borderRadius: 'var(--r-sm)' }}>
            {result.rewrittenContent}
          </div>
          <div className="divider" />
          <p style={{ fontSize: 12, color: 'var(--color-muted)' }}>Applied tone: <strong>{result.toneName}</strong></p>
        </div>
      ) : (
        <div className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 280, textAlign: 'center' }}>
          <RefreshCw size={32} color="var(--color-muted-soft)" style={{ marginBottom: 12 }} />
          <p style={{ fontSize: 14, color: 'var(--color-muted)' }}>Rewritten content will appear here</p>
        </div>
      )}
    </div>
  );
}

/* ─── Generate Video Tab ─────────────────────────────────────────────────── */
function GenerateVideoTab() {
  const [instagramUrl, setInstagramUrl] = useState('');
  const [template, setTemplate] = useState<'slideshow' | 'reel'>('slideshow');
  const [loading, setLoading] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState('');
  const [result, setResult] = useState<VideoGenerationResponse | null>(null);
  const [addingToQueue, setAddingToQueue] = useState(false);
  const { toast } = useToast();

  const progressMessages = [
    'Scraping Instagram post…',
    'Bundling Remotion compositions…',
    'Rendering video frames…',
    'Uploading to Cloudinary…',
    'Almost done…',
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!instagramUrl.trim()) { toast('Enter an Instagram URL', 'error'); return; }
    setLoading(true);
    setResult(null);

    let msgIdx = 0;
    setLoadingMsg(progressMessages[0]);
    const interval = setInterval(() => {
      msgIdx = Math.min(msgIdx + 1, progressMessages.length - 1);
      setLoadingMsg(progressMessages[msgIdx]);
    }, 12000);

    try {
      const res = await contentApi.generateVideo({ instagramUrl: instagramUrl.trim(), template });
      setResult(res);
      toast('Video generated!', 'success');
    } catch (err: any) {
      toast(err.message, 'error');
    } finally {
      clearInterval(interval);
      setLoading(false);
      setLoadingMsg('');
    }
  };

  const handleAddToQueue = async () => {
    if (!result) return;
    setAddingToQueue(true);
    try {
      await queuesApi.addItem({
        type: 'video',
        url: result.videoUrl,
        text: result.caption,
      });
      toast('Video added to queue!', 'success');
    } catch (err: any) {
      toast(err.message, 'error');
    } finally {
      setAddingToQueue(false);
    }
  };

  return (
    <div className="grid-2" style={{ alignItems: 'start' }}>
      <div className="card">
        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 6 }}>Generate Video from Instagram</h2>
        <p style={{ fontSize: 14, color: 'var(--color-muted)', marginBottom: 24 }}>
          Paste an Instagram post URL — we'll scrape the content and render a realistic MP4 via Remotion.
        </p>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div className="form-group">
            <label className="form-label">Instagram post URL</label>
            <input
              className="input"
              placeholder="https://www.instagram.com/p/abc123/"
              value={instagramUrl}
              onChange={e => setInstagramUrl(e.target.value)}
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Template</label>
            <div style={{ display: 'flex', gap: 10 }}>
              {([
                ['slideshow', 'Slideshow', '1080 × 1080'],
                ['reel', 'Reel', '1080 × 1920'],
              ] as [typeof template, string, string][]).map(([val, lbl, size]) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => setTemplate(val)}
                  disabled={loading}
                  style={{
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 4,
                    padding: '14px 12px',
                    borderRadius: 'var(--r-sm)',
                    border: `2px solid ${template === val ? 'var(--color-primary)' : 'var(--color-hairline)'}`,
                    background: template === val ? '#fff0f1' : 'var(--color-canvas)',
                    color: template === val ? 'var(--color-primary)' : 'var(--color-muted)',
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                  }}
                >
                  <span style={{ fontWeight: 600, fontSize: 14 }}>{lbl}</span>
                  <span style={{ fontSize: 11, opacity: 0.7 }}>{size}</span>
                </button>
              ))}
            </div>
          </div>

          <button className="btn-primary" type="submit" disabled={loading}>
            {loading
              ? <><div className="spinner" style={{ width: 18, height: 18, borderTopColor: '#fff' }} /> {loadingMsg}</>
              : <><Video size={16} /> Generate Video</>}
          </button>
        </form>

        {loading && (
          <div className="fade-in" style={{ marginTop: 20, padding: '14px 16px', background: 'var(--color-surface-soft)', borderRadius: 'var(--r-sm)', fontSize: 13, color: 'var(--color-muted)' }}>
            First run bundles the Remotion compositions (~30–60 s). Subsequent renders are faster.
          </div>
        )}
      </div>

      {result ? (
        <div className="card fade-in">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 style={{ fontSize: 16, fontWeight: 700 }}>Generated Video</h3>
            <span className="badge badge-success">Ready</span>
          </div>

          <video
            src={result.videoUrl}
            controls
            style={{ width: '100%', borderRadius: 'var(--r-sm)', border: '1px solid var(--color-hairline)', marginBottom: 16, maxHeight: 480, objectFit: 'contain', background: '#000' }}
          />

          <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
            <a
              href={result.videoUrl}
              download
              target="_blank"
              rel="noreferrer"
              className="btn-ghost btn-sm"
              style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6 }}
            >
              <Download size={14} /> Download
            </a>
            <a
              href={result.videoUrl}
              target="_blank"
              rel="noreferrer"
              className="btn-ghost btn-sm"
              style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6 }}
            >
              <ExternalLink size={14} /> Open
            </a>
            <button className="btn-primary btn-sm" onClick={handleAddToQueue} disabled={addingToQueue}>
              {addingToQueue
                ? <div className="spinner" style={{ width: 14, height: 14, borderTopColor: '#fff' }} />
                : <Plus size={14} />}
              Add to Queue
            </button>
          </div>

          {result.author && (
            <div className="form-group" style={{ marginBottom: 10 }}>
              <label className="form-label">Author</label>
              <p style={{ fontSize: 14 }}>@{result.author}</p>
            </div>
          )}

          {result.caption && (
            <div className="form-group">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label className="form-label">Caption</label>
                <button className="btn-ghost btn-sm" onClick={() => navigator.clipboard.writeText(result.caption)}>
                  <Copy size={13} /> Copy
                </button>
              </div>
              <div className="code-block" style={{ fontSize: 12, maxHeight: 120, overflowY: 'auto' }}>{result.caption}</div>
            </div>
          )}

          <p style={{ fontSize: 12, color: 'var(--color-muted)', marginTop: 8 }}>
            Template: <strong>{result.template}</strong> · {result.mediaUrls.length} image{result.mediaUrls.length !== 1 ? 's' : ''} scraped
          </p>
        </div>
      ) : (
        <div className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 360, textAlign: 'center' }}>
          <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#fff0f1', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
            <Video size={28} color="var(--color-primary)" />
          </div>
          <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>Your video will appear here</h3>
          <p style={{ fontSize: 14, color: 'var(--color-muted)' }}>Paste an Instagram URL and click Generate Video</p>
        </div>
      )}
    </div>
  );
}

/* ─── Tones Tab ───────────────────────────────────────────────────────────── */
function TonesTab({ tones, loading, onDeleted }: { tones: Tone[]; loading: boolean; onDeleted: () => void }) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<{ name: string; tone: string; description: string }>({ name: '', tone: '', description: '' });
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const { toast } = useToast();

  const startEdit = (tone: Tone) => {
    setEditing(tone._id);
    setEditDraft({ name: tone.name, tone: tone.tone, description: tone.description ?? '' });
    setExpanded(tone._id);
  };

  const cancelEdit = () => { setEditing(null); };

  const handleSave = async (id: string) => {
    setSaving(true);
    try {
      await contentApi.updateTone(id, editDraft);
      onDeleted();
      setEditing(null);
      toast('Tone updated', 'success');
    } catch (err: any) {
      toast(err.message, 'error');
    } finally { setSaving(false); }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete tone "${name}"?`)) return;
    setDeleting(id);
    try {
      await contentApi.deleteTone(id);
      onDeleted();
      toast('Tone deleted', 'success');
    } catch (err: any) {
      toast(err.message, 'error');
    } finally { setDeleting(null); }
  };

  if (loading) return <div className="empty-state" style={{ paddingTop: 80 }}><div className="spinner" /></div>;

  if (tones.length === 0) return (
    <div className="empty-state" style={{ paddingTop: 80 }}>
      <Wand2 size={40} />
      <h3 style={{ fontSize: 18, fontWeight: 600 }}>No saved tones yet</h3>
      <p style={{ fontSize: 14 }}>Use the Generate Tone tab to create your first brand voice.</p>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {tones.map((tone) => (
        <div key={tone._id} className="card-hover">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#fff0f1', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Wand2 size={18} color="var(--color-primary)" />
            </div>
            <div style={{ flex: 1, overflow: 'hidden' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 15, fontWeight: 600 }}>{tone.name}</span>
                {tone.source && <span className="badge badge-muted" style={{ fontSize: 10 }}>{tone.source}</span>}
              </div>
              {tone.description && <p style={{ fontSize: 13, color: 'var(--color-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tone.description}</p>}
            </div>
            <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
              <button className="btn-ghost btn-sm" onClick={() => setExpanded(expanded === tone._id ? null : tone._id)}>
                {expanded === tone._id ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
              </button>
              <button className="btn-ghost btn-sm" onClick={() => startEdit(tone)} title="Edit tone">
                <Pencil size={14} />
              </button>
              <button className="btn-danger btn-sm" onClick={() => handleDelete(tone._id, tone.name)} disabled={deleting === tone._id}>
                <Trash2 size={14} />
              </button>
            </div>
          </div>
          {expanded === tone._id && (
            <div className="fade-in" style={{ marginTop: 16 }}>
              <div className="divider" style={{ margin: '0 0 16px' }} />
              {editing === tone._id ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div className="form-group">
                    <label className="form-label">Name</label>
                    <input className="input" value={editDraft.name} onChange={e => setEditDraft(d => ({ ...d, name: e.target.value }))} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Description</label>
                    <input className="input" value={editDraft.description} onChange={e => setEditDraft(d => ({ ...d, description: e.target.value }))} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Tone prompt</label>
                    <textarea className="textarea" rows={5} value={editDraft.tone} onChange={e => setEditDraft(d => ({ ...d, tone: e.target.value }))} />
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="btn-primary btn-sm" onClick={() => handleSave(tone._id)} disabled={saving}>
                      {saving ? <div className="spinner" style={{ width: 14, height: 14, borderTopColor: '#fff' }} /> : <Check size={14} />} Save
                    </button>
                    <button className="btn-ghost btn-sm" onClick={cancelEdit}><X size={14} /> Cancel</button>
                  </div>
                </div>
              ) : (
                <div className="form-group">
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <label className="form-label">Tone prompt</label>
                    <button className="btn-ghost btn-sm" onClick={() => navigator.clipboard.writeText(tone.tone)}><Copy size={13} /> Copy</button>
                  </div>
                  <div className="code-block" style={{ fontSize: 12 }}>{tone.tone}</div>
                </div>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
