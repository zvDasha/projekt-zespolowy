## **Krótki opis projektu.**

**Projekt:** System zarządzania biblioteką z modułem rekomendacji AI.

**Opis:** Tworzymy stronę internetową dla biblioteki. Pozwala ona użytkownikom przeglądać katalog książek oraz zarządzać swoim profilem. Głównym wyróżnikiem naszej aplikacji jest moduł ML, który pomaga czytelnikowi znaleźć idealną książkę. System je proponuje na podstawie kierunku studiów użytkownika oraz analizuje teksty wpisane przez użytkownika (np. opisy lub preferencje). Będzie możliwość czatowania między użytkownikami (pokoje wedle zainteresowań) oraz importu danych z pliku CSV lub XLSX. Aplikacja umożliwia również rezerwację książek online ze sprawdzaniem dostępności egzemplarzy, dodawanie ocen po potwierdzonej rezerwacji, filtrowanie i sortowanie według różnych kategorii oraz skanowanie okładki książki ze zdjęcia w celu szybkiego wyszukiwania. 

**Techniczne aspekty:**

* Frontend: React \- odpowiada za szybki, intuicyjny i estetyczny interfejs użytkownika.  
* Backend: Python \- obsługuje logikę biznesową, autoryzację i algorytmy AI.  
* Baza danych: PostgreSQL \- przechowuje dane o książkach, użytkownikach i rezerwacjach.

## **Wymagania funkcjonalne**

1. **Import danych z plików CSV/Excel** \- Bibliotekarz lub Administrator może wgrać plik CSV z listą nowych książek, a system automatycznie dodaje je do bazy danych.  
2. **Skanowanie tekstu z okładki książki**  \- Użytkownik robi zdjęcie okładki książki, aplikacja odczytuje z niego tytuł oraz autora i wyszukuje tę książkę w katalogu.  
3. **Czat dla użytkowników** \- Prosty moduł czatu umożliwiający dyskusję o książkach i wymianę opinii pomiędzy użytkownikami.  
4. **Autoryzacja i rejestracja** \- System umożliwia logowanie, reset hasła przez e-mail oraz rejestrację za pomocą tradycyjnego loginu i hasła lub przy użyciu konta Google.  
5. **Obsługa roli użytkownika** \- Osoba z tą rolą przegląda katalog, ma możliwość rezerwacji książek oraz korzysta z rekomendacji AI.  
6. **Obsługa roli bibliotekarza** \- Osoba z tą rolą wydaje książki, przyjmuje zwroty od czytelników oraz ręcznie dodaje nowe egzemplarze do systemu.  
7. **Obsługa roli administratora** \- Osoba z tą rolą zarządza kontami wszystkich użytkowników i może zmieniać ustawienia całego systemu.  
8. **Edycja profilu użytkownika** \- Użytkownik może edytować swoje dane osobowe w profilu.  
9. **Podgląd historii i ulubionych** \- Użytkownik ma dostęp do swojej listy ulubionych książek.  
10. **Wyszukiwanie książek** \- System pozwala szukać książek w katalogu po tytule oraz po autorze.  
11. **Filtrowanie i sortowanie katalogu** \- Możliwość filtrowania książek po gatunku, roku wydania i numerze ISBN, a także sortowania według oceny lub daty.  
12. **Rezerwacja online i dostępność egzemplarzy** \- System pokazuje dokładną liczbę dostępnych egzemplarzy danej książki oraz umożliwia użytkownikowi zarezerwowanie wybranej pozycji online.  
13. **System oceniania po rezerwacji** \- Użytkownik może dodać ocenę książki dopiero po potwierdzeniu jej rezerwacji przez bibliotekę.  
14. **Statystyki biblioteki** \- System wyświetla sekcje ze statystykami.  
15. **Inteligentne rekomendacje AI/ML** \- Moduł sztucznej inteligencji analizuje opinie użytkowników, wpisane opisy oraz kierunek studiów na profilu, aby dopasować i zaproponować najbardziej odpowiednie książki.

## **Wymagania niefunkcjonalne**

1. **Czas reakcji wyszukiwania do 2 sekund** \- Wyszukiwanie książek w katalogu działa szybko i zwraca wyniki w czasie nie dłuższym niż 2 sekundy.  
2. **Obsługa współbieżnych zapytań** \- Baza danych PostgreSQL jest skonfigurowana tak, aby sprawnie obsługiwać zapytania od wielu użytkowników jednocześnie.  
3. **Szyfrowanie haseł w bazie** \- Hasła wszystkich użytkowników są bezpiecznie szyfrowane przed zapisaniem w bazie danych.  
4. **Walidacja danych wejściowych** \- Wszystkie formularze sprawdzają wprowadzane dane, aby chronić system przed atakami, np. SQL Injection.  
5. **Responsywny interfejs** \- Wygląd aplikacji automatycznie dostosowuje się do ekranów komputerów, tabletów i smartfonów.  
6. **Obsługa motywu jasnego i ciemnego** \- Interfejs użytkownika umożliwia łatwe przełączanie między trybem jasnym a ciemnym.  
7. **Testy jednostkowe i integracyjne** \- Kod jest pokryty testami jednostkowymi i integracyjnymi, co zapewnia stabilność działania aplikacji.  
8. **Aktualizacja dostępności w czasie rzeczywistym** \- Liczba dostępnych egzemplarzy książki oraz status rezerwacji muszą aktualizować się natychmiast po wykonaniu akcji przez użytkownika lub bibliotekarza.  
9. **Integralność danych rezerwacji i ocen** \- System musi blokować możliwość dodania oceny na poziomie bazy danych lub logiki backendowej, jeśli użytkownik nie posiada potwierdzonej rezerwacji.

## 

