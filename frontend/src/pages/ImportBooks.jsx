import { useState } from 'react';
import { Download, Upload } from 'lucide-react';
import { api, errorMessage, refreshData } from '../api';
import { ErrorBox, Notice, PageTitle } from '../components/UI';

export default function ImportBooks() {
  const [file, setFile] = useState(null);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  function choose(event) {
    const selected = event.target.files?.[0];
    setResult(null); setError(''); setFile(null);
    if (!selected) return;
    if (!/\.(csv|xlsx)$/i.test(selected.name)) { setError('Wybierz plik CSV lub XLSX.'); return; }
    if (selected.size > 5 * 1024 * 1024) { setError('Plik jest za duży. Maksymalny rozmiar to 5 MB.'); return; }
    setFile(selected);
  }
  async function upload(dryRun) {
    setBusy(true); setError('');
    const body = new FormData(); body.append('file', file);
    try {
      setResult(await api(`/books/import?dry_run=${dryRun}`, { method: 'POST', body }));
      if (!dryRun) refreshData();
    } catch (error) { setError(error.message); setResult(null); }
    finally { setBusy(false); }
  }
  async function template() {
    setError('');
    try {
      const blob = await api('/books/import/template', { raw: true });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a'); link.href = url; link.download = 'szablon-ksiazek.csv'; link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) { setError(error.message); }
  }
  return <><PageTitle eyebrow="ROZBUDUJ SWÓJ KSIĘGOZBIÓR" title="Import książek" action={<button className="button button-outline" onClick={template}><Download size={17} /> Pobierz szablon CSV</button>}>Dodaj wiele książek z arkusza CSV lub XLSX.</PageTitle><div className="two-columns"><section className="panel"><label className="upload-area"><Upload size={36} strokeWidth={1.3} /><strong>Wybierz plik z książkami</strong><span>CSV lub XLSX · do 5 MB · do 5000 wierszy</span><input type="file" accept=".csv,.xlsx" onChange={choose} disabled={busy} aria-label="Plik z książkami" /></label>{file && <p className="small">{file.name} · {(file.size / 1024).toFixed(1)} KB</p>}<ErrorBox error={error} /><div className="actions import-actions"><button className="button" disabled={!file || busy} onClick={() => upload(true)}>{busy ? 'Przetwarzanie…' : 'Sprawdź plik'}</button>{result?.dry_run && result.created > 0 && <button className="button button-outline" disabled={busy} onClick={() => upload(false)}>Importuj poprawne wiersze ({result.created})</button>}</div><Notice>Najpierw sprawdź plik. Książki trafią do katalogu dopiero po kliknięciu „Importuj poprawne wiersze”.</Notice></section><section className="panel"><h2>Jak przygotować plik?</h2><ol className="instructions"><li>Pobierz szablon i zastąp przykład swoimi książkami.</li><li>Zachowaj nagłówki: <code>title, author, isbn, genre</code>.</li><li>Możesz dodać: <code>publication_year, description, cover_url, copies</code>.</li><li>ISBN zapisz jako tekst, aby arkusz nie zmienił numeru.</li><li>Plik CSV zapisz w UTF-8, z przecinkami lub średnikami. W XLSX użyj pierwszego arkusza.</li></ol><p className="small">Pusta liczba egzemplarzy oznacza 1. Duplikaty ISBN zostaną pominięte. Błędne wiersze nie zatrzymują importu poprawnych pozycji.</p></section></div>{result && <section className="panel import-result"><h2>{result.dry_run ? 'Wynik sprawdzania' : 'Import zakończony'}</h2><div className="import-totals"><span><strong>{result.created}</strong> {result.dry_run ? 'gotowych do importu' : 'dodanych książek'}</span><span><strong>{result.skipped}</strong> pominiętych wierszy</span></div>{result.dry_run && <p className="small">To podgląd. Dane nie zostały jeszcze zapisane.</p>}{result.errors.length > 0 && <div className="table-scroll"><table><caption>Wiersze wymagające poprawy</caption><thead><tr><th>Wiersz</th><th>ISBN</th><th>Problem</th></tr></thead><tbody>{result.errors.map((row, i) => <tr key={`${row.row}-${i}`}><td>{row.row}</td><td>{row.isbn || '—'}</td><td>{errorMessage(row.message, 422)}</td></tr>)}</tbody></table></div>}</section>}</>;
}
