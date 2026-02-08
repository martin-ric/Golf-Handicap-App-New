/**
 * Golf Handicap – Score Differential
 * Refactored: Modulare Struktur, robuste Validierung, verbesserte Fehlerbehandlung,
 * XSS-Schutz (nur textContent), Accessibility-Optimierungen
 */

(function () {
  "use strict";

  // ============================================================================
  // KONFIGURATION
  // ============================================================================

  var CONFIG = {
    STORAGE_KEY: "golf-handicap-rounds",
    MAX_ROUNDS_FOR_HANDICAP: 20,
    BEST_ROUNDS_COUNT: 8,
    WHS_MULTIPLIER: 0.96,
    CONSTANT_SLOPE: 113
  };

  // ============================================================================
  // VALIDATION SERVICE
  // ============================================================================

  var ValidationService = {
    /**
     * Validiert ein Datum (YYYY-MM-DD Format).
     * @param {string} datum - Datum-String
     * @returns {{valid: boolean, error: string|null}}
     */
    validiereDatum: function (datum) {
      if (!datum || typeof datum !== "string") {
        return { valid: false, error: "Bitte ein gültiges Datum angeben." };
      }
      var trimmed = datum.trim();
      if (!trimmed) {
        return { valid: false, error: "Bitte ein Datum angeben." };
      }
      // Prüfe Format YYYY-MM-DD
      var regex = /^\d{4}-\d{2}-\d{2}$/;
      if (!regex.test(trimmed)) {
        return { valid: false, error: "Ungültiges Datumsformat. Bitte YYYY-MM-DD verwenden." };
      }
      var dateObj = new Date(trimmed + "T00:00:00");
      if (isNaN(dateObj.getTime())) {
        return { valid: false, error: "Ungültiges Datum." };
      }
      // Prüfe auf zukünftige Daten (max. heute)
      var heute = new Date();
      heute.setHours(0, 0, 0, 0);
      if (dateObj > heute) {
        return { valid: false, error: "Das Datum darf nicht in der Zukunft liegen." };
      }
      return { valid: true, error: null };
    },

    /**
     * Validiert einen Brutto-Score.
     * @param {string|number} score - Score-Wert
     * @returns {{valid: boolean, error: string|null, value: number|null}}
     */
    validiereScore: function (score) {
      if (score === "" || score === null || score === undefined) {
        return { valid: false, error: "Bitte einen Brutto-Score eingeben.", value: null };
      }
      var num = typeof score === "string" ? parseFloat(score) : Number(score);
      if (isNaN(num) || !isFinite(num)) {
        return { valid: false, error: "Brutto-Score muss eine gültige Zahl sein.", value: null };
      }
      if (num < 1 || num > 200) {
        return { valid: false, error: "Brutto-Score muss zwischen 1 und 200 liegen.", value: null };
      }
      if (num !== Math.floor(num)) {
        return { valid: false, error: "Brutto-Score muss eine ganze Zahl sein.", value: null };
      }
      return { valid: true, error: null, value: num };
    },

    /**
     * Validiert Course Rating.
     * @param {string|number} cr - Course Rating
     * @returns {{valid: boolean, error: string|null, value: number|null}}
     */
    validiereCourseRating: function (cr) {
      if (cr === "" || cr === null || cr === undefined) {
        return { valid: false, error: "Bitte ein Course Rating eingeben.", value: null };
      }
      var num = typeof cr === "string" ? parseFloat(cr) : Number(cr);
      if (isNaN(num) || !isFinite(num)) {
        return { valid: false, error: "Course Rating muss eine gültige Zahl sein.", value: null };
      }
      if (num < 50 || num > 80) {
        return { valid: false, error: "Course Rating muss zwischen 50 und 80 liegen.", value: null };
      }
      return { valid: true, error: null, value: num };
    },

    /**
     * Validiert Slope Rating.
     * @param {string|number} slope - Slope Rating
     * @returns {{valid: boolean, error: string|null, value: number|null}}
     */
    validiereSlope: function (slope) {
      if (slope === "" || slope === null || slope === undefined) {
        return { valid: false, error: "Bitte ein Slope Rating eingeben.", value: null };
      }
      var num = typeof slope === "string" ? parseFloat(slope) : Number(slope);
      if (isNaN(num) || !isFinite(num)) {
        return { valid: false, error: "Slope Rating muss eine gültige Zahl sein.", value: null };
      }
      if (num < 55 || num > 155) {
        return { valid: false, error: "Slope Rating muss zwischen 55 und 155 liegen.", value: null };
      }
      if (num !== Math.floor(num)) {
        return { valid: false, error: "Slope Rating muss eine ganze Zahl sein.", value: null };
      }
      return { valid: true, error: null, value: num };
    },

    /**
     * Validiert eine komplette Runde.
     * @param {Object} runde - Runden-Objekt
     * @returns {{valid: boolean, error: string|null}}
     */
    validiereRunde: function (runde) {
      if (!runde || typeof runde !== "object") {
        return { valid: false, error: "Ungültiges Runden-Objekt." };
      }
      var required = ["id", "date", "score", "courseRating", "slope", "differential"];
      for (var i = 0; i < required.length; i++) {
        if (!(required[i] in runde)) {
          return { valid: false, error: "Runden-Objekt fehlt erforderliches Feld: " + required[i] + "." };
        }
      }
      if (typeof runde.differential !== "number" || isNaN(runde.differential)) {
        return { valid: false, error: "Ungültiger Differential-Wert." };
      }
      return { valid: true, error: null };
    }
  };

  // ============================================================================
  // STORAGE SERVICE
  // ============================================================================

  var StorageService = {
    /**
     * Runden aus LocalStorage laden mit Fehlerbehandlung.
     * @returns {Array<Object>} Array der Runden oder leeres Array bei Fehler
     */
    ladeRunden: function () {
      try {
        var raw = localStorage.getItem(CONFIG.STORAGE_KEY);
        if (!raw) return [];
        var parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) {
          console.warn("LocalStorage enthält kein Array. Setze zurück.");
          return [];
        }
        // Validiere jede Runde
        var validierte = [];
        for (var i = 0; i < parsed.length; i++) {
          var validierung = ValidationService.validiereRunde(parsed[i]);
          if (validierung.valid) {
            validierte.push(parsed[i]);
          } else {
            console.warn("Ungültige Runde übersprungen:", validierung.error);
          }
        }
        return validierte;
      } catch (e) {
        console.error("Fehler beim Laden aus LocalStorage:", e);
        return [];
      }
    },

    /**
     * Runden in LocalStorage speichern mit Fehlerbehandlung.
     * @param {Array<Object>} runden - Array der Runden
     * @returns {{success: boolean, error: string|null}}
     */
    speichereRunden: function (runden) {
      if (!Array.isArray(runden)) {
        return { success: false, error: "Runden müssen ein Array sein." };
      }
      try {
        var json = JSON.stringify(runden);
        localStorage.setItem(CONFIG.STORAGE_KEY, json);
        return { success: true, error: null };
      } catch (e) {
        if (e.name === "QuotaExceededError") {
          return { success: false, error: "Speicherplatz voll. Bitte alte Runden löschen." };
        }
        console.error("Fehler beim Speichern in LocalStorage:", e);
        return { success: false, error: "Fehler beim Speichern: " + e.message };
      }
    },

    /**
     * Alle Runden löschen.
     * @returns {{success: boolean, error: string|null}}
     */
    loescheAlle: function () {
      try {
        localStorage.removeItem(CONFIG.STORAGE_KEY);
        return { success: true, error: null };
      } catch (e) {
        console.error("Fehler beim Löschen aus LocalStorage:", e);
        return { success: false, error: "Fehler beim Löschen: " + e.message };
      }
    }
  };

  // ============================================================================
  // WHS SERVICE (World Handicap System Berechnungen)
  // ============================================================================

  var WHSService = {
    /**
     * Berechnet Score Differential nach WHS-Formel.
     * Formel: (113 / Slope) * (Score - Course Rating)
     * @param {number} score - Brutto-Score
     * @param {number} courseRating - Course Rating
     * @param {number} slope - Slope Rating
     * @returns {number} Score Differential (auf 1 Dezimalstelle gerundet)
     */
    berechneScoreDifferential: function (score, courseRating, slope) {
      var differential = (CONFIG.CONSTANT_SLOPE / slope) * (score - courseRating);
      return Math.round(differential * 10) / 10;
    },

    /**
     * Berechnet Handicap-Index nach WHS: beste 8 aus letzten 20 Runden.
     * @param {Array<Object>} runden - Alle Runden (neueste zuerst)
     * @returns {number|null} Handicap-Index oder null wenn zu wenig Daten
     */
    berechneHandicapIndex: function (runden) {
      if (!runden || runden.length === 0) {
        return null;
      }
      var letzte20 = runden.slice(0, CONFIG.MAX_ROUNDS_FOR_HANDICAP);
      // Sortiere nach Differential (aufsteigend = beste zuerst)
      var sortiert = letzte20.slice().sort(function (a, b) {
        return a.differential - b.differential;
      });
      var anzahlBeste = Math.min(CONFIG.BEST_ROUNDS_COUNT, sortiert.length);
      var beste = sortiert.slice(0, anzahlBeste);
      // Durchschnitt berechnen
      var summe = beste.reduce(function (acc, r) {
        return acc + r.differential;
      }, 0);
      var durchschnitt = summe / anzahlBeste;
      // WHS-Multiplikator anwenden
      var handicap = Math.round(durchschnitt * CONFIG.WHS_MULTIPLIER * 10) / 10;
      return handicap;
    },

    /**
     * Gibt Informationen über die Handicap-Berechnung zurück.
     * @param {Array<Object>} runden - Alle Runden
     * @returns {{handicap: number|null, verwendeteRunden: number, gesamtRunden: number}}
     */
    getHandicapInfo: function (runden) {
      var gesamt = runden.length;
      var verwendete = Math.min(CONFIG.MAX_ROUNDS_FOR_HANDICAP, gesamt);
      var beste = Math.min(CONFIG.BEST_ROUNDS_COUNT, verwendete);
      var handicap = this.berechneHandicapIndex(runden);
      return {
        handicap: handicap,
        verwendeteRunden: beste,
        gesamtRunden: verwendete
      };
    }
  };

  // ============================================================================
  // UI SERVICE
  // ============================================================================

  var UIService = {
    /**
     * Formatiert Datum von YYYY-MM-DD zu DD.MM.YYYY.
     * @param {string} iso - ISO-Datum
     * @returns {string} Formatiertes Datum
     */
    formatDatum: function (iso) {
      var teile = iso.split("-");
      if (teile.length !== 3) return iso;
      return teile[2] + "." + teile[1] + "." + teile[0];
    },

    /**
     * Setzt heutiges Datum in ein date-Input-Feld.
     * @param {HTMLInputElement} input - Datum-Input-Element
     */
    setzeHeute: function (input) {
      if (!input || input.type !== "date") return;
      var heute = new Date();
      var j = heute.getFullYear();
      var m = String(heute.getMonth() + 1).padStart(2, "0");
      var t = String(heute.getDate()).padStart(2, "0");
      input.value = j + "-" + m + "-" + t;
    },

    /**
     * Zeigt eine Fehlermeldung an (nur textContent, XSS-sicher).
     * @param {HTMLElement} container - Container-Element
     * @param {string} nachricht - Fehlermeldung
     */
    zeigeFehler: function (container, nachricht) {
      if (!container) return;
      container.textContent = "";
      container.classList.remove("sichtbar");
      requestAnimationFrame(function () {
        container.textContent = nachricht || "Ein Fehler ist aufgetreten.";
        container.classList.add("sichtbar");
        container.setAttribute("role", "alert");
        container.setAttribute("aria-live", "assertive");
      });
    },

    /**
     * Zeigt ein Ergebnis an (nur textContent, XSS-sicher).
     * @param {HTMLElement} container - Container-Element
     * @param {number} differential - Score Differential
     */
    zeigeErgebnis: function (container, differential) {
      if (!container) return;
      container.textContent = "";
      container.classList.remove("sichtbar");
      requestAnimationFrame(function () {
        container.classList.add("sichtbar");
        container.removeAttribute("role");
        container.setAttribute("aria-live", "polite");
        var label = document.createElement("span");
        label.textContent = "Score Differential";
        var wert = document.createElement("span");
        wert.className = "wert";
        wert.textContent = String(differential);
        container.appendChild(label);
        container.appendChild(wert);
      });
    },

    /**
     * Leert den Ergebnis-Container.
     * @param {HTMLElement} container - Container-Element
     */
    leereErgebnis: function (container) {
      if (!container) return;
      container.textContent = "";
      container.classList.remove("sichtbar");
      container.removeAttribute("role");
    }
  };

  // ============================================================================
  // APPLICATION (Hauptlogik)
  // ============================================================================

  var App = {
    // DOM-Referenzen
    elements: {
      form: null,
      datumInput: null,
      bruttoInput: null,
      courseRatingInput: null,
      slopeInput: null,
      ergebnisDiv: null,
      handicapWert: null,
      handicapHinweis: null,
      rundenListe: null,
      rundenLeer: null,
      btnAlleLoeschen: null
    },

    /**
     * Initialisiert die App.
     */
    init: function () {
      // DOM-Referenzen sammeln
      this.elements.form = document.getElementById("handicap-form");
      this.elements.datumInput = document.getElementById("runden-datum");
      this.elements.bruttoInput = document.getElementById("brutto-score");
      this.elements.courseRatingInput = document.getElementById("course-rating");
      this.elements.slopeInput = document.getElementById("slope-rating");
      this.elements.ergebnisDiv = document.getElementById("ergebnis");
      this.elements.handicapWert = document.getElementById("handicap-wert");
      this.elements.handicapHinweis = document.getElementById("handicap-hinweis");
      this.elements.rundenListe = document.getElementById("runden-liste");
      this.elements.rundenLeer = document.getElementById("runden-leer");
      this.elements.btnAlleLoeschen = document.getElementById("alle-loeschen");

      // Prüfe ob alle Elemente vorhanden sind
      var fehlend = [];
      for (var key in this.elements) {
        if (!this.elements[key]) {
          fehlend.push(key);
        }
      }
      if (fehlend.length > 0) {
        console.error("Fehlende DOM-Elemente:", fehlend);
        return;
      }

      // Event-Listener registrieren
      this.elements.form.addEventListener("submit", this.handleSubmit.bind(this));
      this.elements.btnAlleLoeschen.addEventListener("click", this.handleAlleLoeschen.bind(this));

      // Initialisierung
      UIService.setzeHeute(this.elements.datumInput);
      this.aktualisiereUI();
    },

    /**
     * Behandelt Formular-Submit.
     * @param {Event} event - Submit-Event
     */
    handleSubmit: function (event) {
      event.preventDefault();
      UIService.leereErgebnis(this.elements.ergebnisDiv);

      // Eingaben lesen
      var datumRaw = this.elements.datumInput.value;
      var scoreRaw = this.elements.bruttoInput.value;
      var crRaw = this.elements.courseRatingInput.value;
      var slopeRaw = this.elements.slopeInput.value;

      // Validierung
      var datumVal = ValidationService.validiereDatum(datumRaw);
      if (!datumVal.valid) {
        UIService.zeigeFehler(this.elements.ergebnisDiv, datumVal.error);
        this.elements.datumInput.setAttribute("aria-invalid", "true");
        this.elements.datumInput.focus();
        return;
      }
      this.elements.datumInput.removeAttribute("aria-invalid");

      var scoreVal = ValidationService.validiereScore(scoreRaw);
      if (!scoreVal.valid) {
        UIService.zeigeFehler(this.elements.ergebnisDiv, scoreVal.error);
        this.elements.bruttoInput.setAttribute("aria-invalid", "true");
        this.elements.bruttoInput.focus();
        return;
      }
      this.elements.bruttoInput.removeAttribute("aria-invalid");

      var crVal = ValidationService.validiereCourseRating(crRaw);
      if (!crVal.valid) {
        UIService.zeigeFehler(this.elements.ergebnisDiv, crVal.error);
        this.elements.courseRatingInput.setAttribute("aria-invalid", "true");
        this.elements.courseRatingInput.focus();
        return;
      }
      this.elements.courseRatingInput.removeAttribute("aria-invalid");

      var slopeVal = ValidationService.validiereSlope(slopeRaw);
      if (!slopeVal.valid) {
        UIService.zeigeFehler(this.elements.ergebnisDiv, slopeVal.error);
        this.elements.slopeInput.setAttribute("aria-invalid", "true");
        this.elements.slopeInput.focus();
        return;
      }
      this.elements.slopeInput.removeAttribute("aria-invalid");

      // Berechnung
      var differential = WHSService.berechneScoreDifferential(
        scoreVal.value,
        crVal.value,
        slopeVal.value
      );
      UIService.zeigeErgebnis(this.elements.ergebnisDiv, differential);

      // Speichern
      var runden = StorageService.ladeRunden();
      var neueRunde = {
        id: String(Date.now()),
        date: datumRaw.trim(),
        score: scoreVal.value,
        courseRating: crVal.value,
        slope: slopeVal.value,
        differential: differential
      };
      runden.unshift(neueRunde);
      var speicherErgebnis = StorageService.speichereRunden(runden);
      if (!speicherErgebnis.success) {
        UIService.zeigeFehler(this.elements.ergebnisDiv, speicherErgebnis.error);
        return;
      }

      // UI aktualisieren
      this.aktualisiereUI();
    },

    /**
     * Behandelt "Alle löschen"-Klick.
     */
    handleAlleLoeschen: function () {
      var runden = StorageService.ladeRunden();
      if (runden.length === 0) return;
      if (!confirm("Wirklich alle gespeicherten Runden löschen?")) return;
      var loeschErgebnis = StorageService.loescheAlle();
      if (!loeschErgebnis.success) {
        alert("Fehler beim Löschen: " + loeschErgebnis.error);
        return;
      }
      UIService.leereErgebnis(this.elements.ergebnisDiv);
      this.aktualisiereUI();
    },

    /**
     * Löscht eine einzelne Runde.
     * @param {string} id - Runden-ID
     */
    loescheRunde: function (id) {
      var runden = StorageService.ladeRunden().filter(function (r) {
        return r.id !== id;
      });
      var speicherErgebnis = StorageService.speichereRunden(runden);
      if (!speicherErgebnis.success) {
        alert("Fehler beim Löschen: " + speicherErgebnis.error);
        return;
      }
      this.aktualisiereUI();
    },

    /**
     * Aktualisiert Handicap-Anzeige.
     */
    aktualisiereHandicap: function () {
      var runden = StorageService.ladeRunden();
      var neuesteZuerst = runden.slice().sort(function (a, b) {
        return b.date.localeCompare(a.date);
      });
      var info = WHSService.getHandicapInfo(neuesteZuerst);
      if (info.handicap !== null) {
        this.elements.handicapWert.textContent = String(info.handicap);
        var hinweis = "Beste " + info.verwendeteRunden + " aus den letzten " + info.gesamtRunden + " Runden";
        this.elements.handicapHinweis.textContent = hinweis;
      } else {
        this.elements.handicapWert.textContent = "—";
        this.elements.handicapHinweis.textContent = "Beste " + CONFIG.BEST_ROUNDS_COUNT + " aus den letzten " + CONFIG.MAX_ROUNDS_FOR_HANDICAP + " Runden";
      }
    },

    /**
     * Rendert die Runden-Liste (nur textContent, XSS-sicher).
     */
    rendereRundenListe: function () {
      this.elements.rundenListe.textContent = "";
      var runden = StorageService.ladeRunden();
      var neuesteZuerst = runden.slice().sort(function (a, b) {
        return b.date.localeCompare(a.date);
      });

      // "Alle löschen"-Button anzeigen/verstecken
      this.elements.btnAlleLoeschen.style.display = neuesteZuerst.length > 0 ? "" : "none";

      neuesteZuerst.forEach(function (r) {
        var karte = document.createElement("div");
        karte.className = "runden-karte";
        karte.setAttribute("data-id", r.id);
        karte.setAttribute("role", "listitem");

        var datumSpan = document.createElement("span");
        datumSpan.className = "runden-karte-datum";
        datumSpan.textContent = UIService.formatDatum(r.date);

        var diffSpan = document.createElement("span");
        diffSpan.className = "runden-karte-differential";
        diffSpan.textContent = "Diff. " + String(r.differential);

        var btnLoeschen = document.createElement("button");
        btnLoeschen.type = "button";
        btnLoeschen.className = "btn-runde-loeschen";
        btnLoeschen.title = "Runde löschen";
        btnLoeschen.setAttribute("aria-label", "Runde vom " + UIService.formatDatum(r.date) + " löschen");
        btnLoeschen.textContent = "×";
        var app = this;
        btnLoeschen.addEventListener("click", function () {
          app.loescheRunde(r.id);
        });

        var details = document.createElement("div");
        details.className = "runden-karte-details";
        details.textContent = "Score " + String(r.score) + " · CR " + String(r.courseRating) + " · Slope " + String(r.slope);

        karte.appendChild(datumSpan);
        karte.appendChild(diffSpan);
        karte.appendChild(btnLoeschen);
        karte.appendChild(details);
        this.elements.rundenListe.appendChild(karte);
      }, this);
    },

    /**
     * Aktualisiert die gesamte UI (Handicap + Liste).
     */
    aktualisiereUI: function () {
      this.aktualisiereHandicap();
      this.rendereRundenListe();
    }
  };

  // ============================================================================
  // START
  // ============================================================================

  // Warte bis DOM geladen ist
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () {
      App.init();
    });
  } else {
    App.init();
  }
})();
