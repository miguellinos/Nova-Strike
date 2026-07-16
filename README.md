# NOVA STRIKE: Galactic Annihilator

Ein hochoktaniger, browserbasierter Space-Shooter, gebaut mit **HTML5 Canvas** und **JavaScript**. Steuere deinen Sternjäger durch endlose Wellen von Gegnern, verbessere deine Waffen im Weapon Lab und stelle dich gewaltigen Boss-Schiffen.

## Features

* Schnelles, actiongeladenes Gameplay
* 4 einzigartige Waffen:

  * Plasma
  * Scatter
  * Laser
  * Nova
* 5 Upgrade-Stufen pro Waffe
* Bosskämpfe mit großen Gegnern
* Komplett im Browser spielbar
* Entwickelt mit purem HTML5 Canvas und JavaScript, ohne Game Engine

## Spielprinzip

Du startest mit einem leichten Schiff und kämpfst dich durch immer stärkere Gegnerwellen. Mit jedem abgeschossenen Feind sammelst du Fortschritt, verbesserst deine Ausrüstung und schaltest mehr Feuerkraft frei. Je länger du überlebst, desto gefährlicher werden die Feinde und desto wichtiger wird dein Waffen-Setup.

## Steuerung

* **W A S D**: Bewegen
* **Maus**: Zielen
* **Linksklick**: Schießen
* **Rechtsklick**: Nahkampf-Attacke (Messer)
* **R**: Nachladen
* **Shift**: Dash
* **1–9**: Waffe wechseln
* **Q**: Medkit benutzen
* **E**: Schild aufladen
* **G**: Handgranate werfen
* **F**: Werkbank / Shop / Geldautomat öffnen (wenn in der Nähe)
* **Escape**: Pause / Menü schließen
* **M**: Dev-Modus (nur im Hauptmenü — Startwelle, Karte & Waffen wählen)

## Installation

1. Repository klonen:

   ```bash
   git clone https://github.com/miguellinos/Nova-Strike.git
   ```
2. In den Projektordner wechseln:

   ```bash
   cd Nova-Strike
   ```
3. **Solo spielen:** `index.html` direkt im Browser öffnen.
4. **LAN-Koop:** Node-Server starten (benötigt [Node.js](https://nodejs.org) ≥ 18):

   ```bash
   npm install
   npm start
   ```

   Danach im Browser `http://localhost:3000` öffnen (Host). Der Mitspieler im selben WLAN öffnet die angezeigte LAN-Adresse und tritt mit dem Raumcode bei.

## Entwicklung

Das Projekt ist bewusst leichtgewichtig gehalten und eignet sich gut als Grundlage für:

* Arcade-Shooter
* Canvas-Grafikexperimente
* Lernprojekte für JavaScript-Game-Development
* Erweiterungen wie Power-Ups, Soundeffekte, Highscores oder neue Gegnerarten

## Mögliche Erweiterungen

* Soundeffekte und Musik
* Highscore-System
* Mobile Steuerung
* Mehr Gegner- und Boss-Typen
* Partikel- und Explosions-Effekte
* Schwierigkeitskurve mit Levelsystem
* Pause-Menü und Game-Over-Screen

## Projektstruktur

Die genaue Struktur kann je nach aktueller Version variieren, typischerweise enthält das Projekt:

* `index.html`
* JavaScript-Dateien für Spiel-Logik
* Asset-Dateien für Grafik und ggf. Audio
* Styling für UI und Menüs

## Beitrag

Pull Requests, Ideen und Verbesserungen sind willkommen.
Wenn du neue Features hinzufügen möchtest, achte darauf, dass das Spielgefühl schnell, klar und arcade-lastig bleibt.

## Lizenz

Falls noch keine Lizenz hinterlegt ist, sollte vor einer Veröffentlichung eine passende Lizenz ergänzt werden.

---

**Nova Strike** ist ein reines Browser-Erlebnis für alle, die klassische Arcade-Action mit modernem JavaScript lieben.
