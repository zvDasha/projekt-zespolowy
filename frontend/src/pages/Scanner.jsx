import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Camera, ScanLine, Upload } from 'lucide-react';
import { ErrorBox, Notice, PageTitle } from '../components/UI';

export default function Scanner() {
  const navigate = useNavigate();
  const worker = useRef(null);
  const active = useRef(true);
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState('');
  const [text, setText] = useState('');
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  useEffect(
    () => () => {
      active.current = false;
      worker.current?.terminate();
    },
    [],
  );
  useEffect(() => {
    const url = file ? URL.createObjectURL(file) : '';
    setPreview(url);
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [file]);
  function choose(event) {
    const selected = event.target.files?.[0];
    setError('');
    setText('');
    setQuery('');
    setFile(null);
    if (!selected) return;
    if (
      !['image/jpeg', 'image/png', 'image/webp'].includes(selected.type) ||
      selected.size > 10 * 1024 * 1024
    ) {
      setError('Wybierz zdjęcie JPG, PNG lub WebP do 10 MB.');
      return;
    }
    setFile(selected);
  }
  async function recognize() {
    setBusy(true);
    setError('');
    setProgress(0);
    try {
      const { createWorker } = await import('tesseract.js');
      const instance = await createWorker('pol+eng', 1, {
        logger: (event) => {
          if (active.current && event.status === 'recognizing text')
            setProgress(Math.round(event.progress * 100));
        },
      });
      if (!active.current) {
        await instance.terminate();
        return;
      }
      worker.current = instance;
      const result = await instance.recognize(file);
      if (active.current) {
        setText(result.data.text.trim());
        setQuery(
          result.data.text
            .split('\n')
            .map((s) => s.trim())
            .find((s) => s.length > 3)
            ?.slice(0, 100) || '',
        );
        if (!result.data.text.trim())
          setError('Nie udało się odczytać tekstu. Spróbuj zrobić wyraźniejsze zdjęcie.');
      }
    } catch {
      if (active.current) setError('Nie udało się odczytać zdjęcia. Sprawdź połączenie i format pliku.');
    } finally {
      await worker.current?.terminate();
      worker.current = null;
      if (active.current) setBusy(false);
    }
  }
  return (
    <>
      <PageTitle eyebrow="ZDJĘCIE ZAMIAST PISANIA" title="Skanuj okładkę">
        Odczytaj tytuł lub autora i znajdź książkę w naszym katalogu.
      </PageTitle>
      <div className="two-columns">
        <section className="panel">
          <label className="upload-area">
            <Camera size={36} strokeWidth={1.3} />
            <strong>Dodaj zdjęcie okładki</strong>
            <span>JPG, PNG lub WebP · maks. 10 MB</span>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              capture="environment"
              onChange={choose}
              disabled={busy}
              aria-label="Zdjęcie okładki"
            />
          </label>
          {preview && <img src={preview} className="scan-preview" alt="Wybrana okładka do odczytania" />}
          <button className="button full-width" disabled={!file || busy} onClick={recognize}>
            <ScanLine size={18} />
            {busy ? `Odczytywanie… ${progress}%` : 'Odczytaj tekst'}
          </button>
          <Notice>
            Zdjęcie jest odczytywane w Twojej przeglądarce. Pierwsze skanowanie wymaga pobrania słowników i
            może potrwać dłużej.
          </Notice>
        </section>
        <section className="panel">
          <Upload size={26} />
          <h2>Sprawdź odczytany tekst</h2>
          <p>Okładki bywają nietypowe. Popraw tytuł albo wybierz z tekstu samo nazwisko autora.</p>
          <ErrorBox error={error} />
          {text && (
            <label>
              Odczytany tekst
              <textarea readOnly value={text} rows={7} />
            </label>
          )}
          <form
            className="form-stack"
            onSubmit={(e) => {
              e.preventDefault();
              if (query.trim()) navigate('/katalog?' + new URLSearchParams({ q: query.trim() }));
            }}
          >
            <label>
              Tytuł lub autor
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                maxLength={100}
                required
                placeholder="Wpisz lub popraw odczytany tytuł"
              />
            </label>
            <button className="button" disabled={!query.trim()}>
              Szukaj w katalogu
            </button>
          </form>
        </section>
      </div>
    </>
  );
}
