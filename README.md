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
* Spielerprofile mit servergespeicherten Einstellungen (SQLite)

## Profile

Beim Start wählst du ein Profil (nur Name, kein Passwort) oder legst ein
neues an. Profile und ihre Einstellungen (Lautstärke, Grafikqualität,
Charakter) werden serverseitig in einer SQLite-Datenbank abgelegt
(`server/db.js`), sodass sie auf jedem Gerät im selben LAN unter demselben
Profilnamen verfügbar sind — nicht nur im `localStorage` des einen Browsers.

## Spielprinzip

Du startest mit einem leichten Schiff und kämpfst dich durch immer stärkere Gegnerwellen. Mit jedem abgeschossenen Feind sammelst du Fortschritt, verbesserst deine Ausrüstung und schaltest mehr Feuerkraft frei. Je länger du überlebst, desto gefährlicher werden die Feinde und desto wichtiger wird dein Waffen-Setup.

## Steuerung

* **Pfeiltasten / WASD**: Bewegen
* **Leertaste**: Schießen
* **Weitere Tasten**: je nach Implementierung im Spiel für Spezialfunktionen oder Menüs

## Installation

1. Repository klonen:

   ```bash
   git clone https://github.com/huzaifajaved80433-max/NOVA-STRIKE-Galactic-Annihilator.git
   ```
2. In den Projektordner wechseln:

   ```bash
   cd NOVA-STRIKE-Galactic-Annihilator
   ```
3. Abhängigkeiten installieren und Server starten (benötigt Node.js 22.5+):

   ```bash
   npm install
   npm start
   ```
4. `http://localhost:3000` im Browser öffnen.

Das Spiel benötigt jetzt den Node-Server für alle Spielmodi (nicht nur Koop):
er liefert die Seiten aus **und** speichert Spielerprofile in einer SQLite-
Datenbank (`server/novastrike.db`, wird beim ersten Start automatisch
angelegt). Direktes Öffnen von `index.html` per Doppelklick funktioniert
nicht mehr, da die Profilauswahl den Server braucht.

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
