import { Link } from 'react-router-dom';
import { MessageCircle, Sparkles, BookOpen } from 'lucide-react';
import { PageTitle } from '../components/UI';

export default function Upcoming({ chat = false }) {
  return (
    <>
      <PageTitle
        eyebrow={chat ? 'DOBRE HISTORIE ŁĄCZĄ' : 'COŚ SPECJALNIE DLA CIEBIE'}
        title={chat ? 'Kluby czytelnicze' : 'Rekomendacje AI'}
      >
        {chat
          ? 'Miejsce na rozmowy o książkach i wymianę czytelniczych odkryć.'
          : 'Książki dopasowane do Twoich zainteresowań i kierunku studiów.'}
      </PageTitle>
      <section className="feature-intro">
        <div className="feature-symbol">
          {chat ? <MessageCircle size={42} strokeWidth={1.2} /> : <Sparkles size={42} strokeWidth={1.2} />}
        </div>
        <span className="status status-pending">W przygotowaniu</span>
        <h2>{chat ? 'Wkrótce porozmawiamy między wierszami.' : 'Poznajmy Twój czytelniczy gust.'}</h2>
        <p>
          {chat
            ? 'Kluby nie są jeszcze dostępne. Gdy uruchomimy rozmowy, spotkasz tu czytelników o podobnych zainteresowaniach.'
            : 'Rekomendacje nie są jeszcze dostępne. Już teraz możesz zapisać kierunek studiów i zainteresowania w profilu, aby przygotować go na uruchomienie tej funkcji.'}
        </p>
        <Link className="button" to={chat ? '/katalog' : '/profil'}>
          {chat ? 'Odkryj książki' : 'Uzupełnij profil'}
        </Link>
      </section>
      {chat && (
        <div className="club-grid">
          {['Klasyka', 'Informatyka i AI', 'Psychologia', 'Fantastyka'].map((name) => (
            <article className="panel" key={name}>
              <BookOpen size={24} />
              <h3>{name}</h3>
              <p>Klub w przygotowaniu</p>
            </article>
          ))}
        </div>
      )}
    </>
  );
}
