
# Technické zadání – Webová hra Snake (HTML/CSS/JS)

## 1) Cíl projektu
Vytvořit jednoduchou 2D webovou hru typu **Snake**, běžící v moderních webových prohlížečích na desktopu i mobilních zařízeních, bez použití externích knihoven či frameworků.

Hráč ovládá hada, sbírá potravu, roste a snaží se dosáhnout co nejvyššího skóre. Hra obsahuje volitelný **wrap-around režim**, skóre, high score, pauzu, restart a vícekrokový vstup do hry (loading → intro → hra).

---

## 2) Technologie a omezení

- Frontend only, bez backendu
- HTML5, CSS3, Vanilla JavaScript (ES6+)
- Bez frameworků a herních knihoven
- Vykreslování přes **HTML Canvas**

### Struktura souborů
/snake
 ├─ index.html
 ├─ styles.css
 └─ game.js

---

## 3) Stavový model aplikace

Stavy:

- loading
- intro
- running
- paused
- gameover

Tok:

loading → intro → running → paused → running → gameover

---

## 4) Obrazovky

### 4.1 Loading Screen
- Fullscreen overlay
- Text „Loading…“
- Spinner / progress indikátor
- Zobrazení min. 400–800 ms
- Automatický přechod na Intro

### 4.2 Intro Screen

Obsah:

- Název hry
- Pravidla
- Ovládání
- Checkbox Wrap-around
- Tlačítko Start

#### Ovládání

Desktop:
- Šipky / WASD
- Mezerník – pauza
- R – restart

Mobil:
- Pouze swipe gesta
- Bez směrových tlačítek

### 4.3 Herní obrazovka

- Canvas
- Score
- High Score
- Pause
- Restart

### 4.4 Overlays

Paused:
- Text „Paused“

Game Over:
- Score
- High Score
- Restart

---

## 5) Herní mechaniky

### Herní plocha
- 20×20 grid
- Responsivní canvas

### Had
- Start délka: 3
- Start střed
- Směr doprava

Reprezentace:
snake = [{x,y}]

### Potrava
- 1 kus
- Náhodná pozice
- Nesmí být na hadovi

Efekt:
- Růst
- Score +1

### Kolize

Tělo → Game Over

Stěna:

wrapEnabled = false → Game Over

wrapEnabled = true → průchod:

x < 0 → max  
x >= max → 0  
y < 0 → max  
y >= max → 0  

---

## 6) Herní smyčka

setInterval(tick, TICK_MS)

Tick:

1. Směr
2. Nová hlava
3. Wrap / wall
4. Body kolize
5. Přidat hlavu
6. Jídlo?
7. Odebrat ocas
8. Render

---

## 7) Ovládání

### Desktop
- Arrow / WASD
- Space – pauza
- R – restart

### Mobil – swipe

touchstart + touchend

dx / dy výpočet

SWIPE_THRESHOLD_PX = 30

CSS:
touch-action: none;

---

## 8) UI/UX

- Kontrastní barvy
- Viditelná hlava
- Responsivní layout

---

## 9) Konfigurace

GRID_SIZE = 20  
TILE_SIZE = 20  
TICK_MS = 120  
INITIAL_LENGTH = 3  
SCORE_PER_FOOD = 1  
SWIPE_THRESHOLD_PX = 30  
wrapEnabled = false  

---

## 10) Ukládání

localStorage:

- snakeHighScore
- snakeWrapPreference

---

## 11) Edge Cases

- Spawn mimo hada
- Plná mapa = výhra (volitelné)
- Pauza stopne tick
- Restart reset

---

## 12) Akceptační kritéria

1. Loading → Intro
2. Wrap volba funguje
3. Start spustí hru
4. Růst hada
5. Kolize tělo = konec
6. Wrap funguje
7. Swipe mobil
8. Bez směrových tlačítek
9. Pauza funguje
10. High Score se ukládá

---

## 13) Dodávka

- index.html
- styles.css
- game.js

Spuštění: otevřít index.html
