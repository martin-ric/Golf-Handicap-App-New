/**
 * Golf Handicap – Score Differential
 * Berechnet das Score Differential, speichert Runden im LocalStorage,
 * zeigt Handicap (beste 8 aus letzten 20) und Runden-Liste mit Löschen-Optionen.
 */

(function () {
  "use strict";

  var STORAGE_KEY = "golf-handicap-rounds";

  var form = document.getElementById("handicap-form");
  var datumInput = document.getElementById("runden-datum");
  var bruttoInput = document.getElementById("brutto-score");
  var courseRatingInput = document.getElementById("course-rating");
  var slopeInput = document.getElementById("slope-rating");
  var ergebnisDiv = document.getElementById("ergebnis");
  var handicapWert = document.getElementById("handicap-wert");
  var handicapHinweis = document.getElementById("handicap-hinweis");
  var rundenListe = document.getElementById("runden-liste");
  var rundenLeer = document.getElementById("runden-leer");
  var btnAlleLoeschen = document.getElementById("alle-loeschen");

  /**
   * Heutiges Datum als YYYY-MM-DD für input[type="date"] setzen.
   */
  function setzeHeute() {
    var heute = new Date();
    var j = heute.getFullYear();
    var m = String(heute.getMonth() + 1).padStart(2, "0");
    var t = String(heute.getDate()).padStart(2, "0");
    datumInput.value = j + "-" + m + "-" + t;
  }

  /**
   * Runden aus dem LocalStorage lesen.
   * @returns {Array<{id: string, date: string, score: number, courseRating: number, slope: number, differential: number}>}
   */
  function ladeRunden() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      var parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      return [];
    }
  }

  /**
   * Runden im LocalStorage speichern.
   * @param {Array} runden - Array der Runden-Objekte
   */
  function speichereRunden(runden) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(runden));
  }

  /**
   * Score Differential berechnen.
   * Formel: (113 / Slope) * (Score - Course Rating)
   */
  function berechneScoreDifferential(score, courseRating, slope) {
    var differential = (113 / slope) * (score - courseRating);
    return Math.round(differential * 10) / 10;
  }

  /**
   * Handicap-Index berechnen: beste 8 Score Differentials aus den letzten 20 Runden,
   * Durchschnitt * 0.96 (WHS). Bei weniger als 20 Runden: beste 8 aus allen, bei weniger als 8: alle nutzen.
   * @param {Array} runden - Alle Runden (neueste zuerst erwartet)
   * @returns {number|null} Handicap auf 1 Dezimalstelle oder null wenn zu wenig Daten
   */
  function berechneHandicap(runden) {
    if (runden.length < 1) return null;
    var letzte20 = runden.slice(0, 20);
    var sortiert = letzte20.slice().sort(function (a, b) {
      return a.differential - b.differential;
    });
    var anzahl = Math.min(8, sortiert.length);
    var beste = sortiert.slice(0, anzahl);
    var summe = beste.reduce(function (acc, r) {
      return acc + r.differential;
    }, 0);
    var durchschnitt = summe / anzahl;
    var handicap = Math.round(durchschnitt * 0.96 * 10) / 10;
    return handicap;
  }

  /**
   * Handicap-Bereich in der UI aktualisieren.
   */
  function aktualisiereHandicap() {
    var runden = ladeRunden();
    var neuesteZuerst = runden.slice().sort(function (a, b) {
      return b.date.localeCompare(a.date);
    });
    var h = berechneHandicap(neuesteZuerst);
    if (h !== null) {
      handicapWert.textContent = h;
      var n = Math.min(20, neuesteZuerst.length);
      var k = Math.min(8, n);
      handicapHinweis.textContent = "Beste " + k + " aus den letzten " + n + " Runden";
    } else {
      handicapWert.textContent = "—";
      handicapHinweis.textContent = "Beste 8 aus den letzten 20 Runden";
    }
  }

  /**
   * Einzelne Runde formatieren: Datum von YYYY-MM-DD zu z.B. 07.02.2026.
   */
  function formatDatum(iso) {
    var teile = iso.split("-");
    if (teile.length !== 3) return iso;
    return teile[2] + "." + teile[1] + "." + teile[0];
  }

  /**
   * Runden-Liste im DOM rendern (neueste zuerst). Pro Runde eine Karte mit Löschen-Button.
   */
  function rendereRundenListe() {
    rundenListe.textContent = "";
    var runden = ladeRunden();
    var neuesteZuerst = runden.slice().sort(function (a, b) {
      return b.date.localeCompare(a.date);
    });

    btnAlleLoeschen.style.display = neuesteZuerst.length > 0 ? "" : "none";

    neuesteZuerst.forEach(function (r) {
      var karte = document.createElement("div");
      karte.className = "runden-karte";
      karte.setAttribute("data-id", r.id);

      var datumSpan = document.createElement("span");
      datumSpan.className = "runden-karte-datum";
      datumSpan.textContent = formatDatum(r.date);

      var diffSpan = document.createElement("span");
      diffSpan.className = "runden-karte-differential";
      diffSpan.textContent = "Diff. " + r.differential;

      var btnLoeschen = document.createElement("button");
      btnLoeschen.type = "button";
      btnLoeschen.className = "btn-runde-loeschen";
      btnLoeschen.title = "Runde löschen";
      btnLoeschen.setAttribute("aria-label", "Runde löschen");
      btnLoeschen.textContent = "×";
      btnLoeschen.addEventListener("click", function () {
        rundeLoeschen(r.id);
      });

      var details = document.createElement("div");
      details.className = "runden-karte-details";
      details.textContent = "Score " + r.score + " · CR " + r.courseRating + " · Slope " + r.slope;

      karte.appendChild(datumSpan);
      karte.appendChild(diffSpan);
      karte.appendChild(btnLoeschen);
      karte.appendChild(details);
      rundenListe.appendChild(karte);
    });
  }

  /**
   * Eine Runde anhand der ID entfernen, speichern und UI aktualisieren.
   */
  function rundeLoeschen(id) {
    var runden = ladeRunden().filter(function (r) {
      return r.id !== id;
    });
    speichereRunden(runden);
    rendereRundenListe();
    aktualisiereHandicap();
  }

  /**
   * Alle Runden löschen (mit Bestätigung).
   */
  function alleLoeschen() {
    if (ladeRunden().length === 0) return;
    if (!confirm("Wirklich alle gespeicherten Runden löschen?")) return;
    speichereRunden([]);
    rendereRundenListe();
    aktualisiereHandicap();
    leereErgebnis();
  }

  function zeigeErgebnis(differential) {
    ergebnisDiv.textContent = "";
    ergebnisDiv.classList.remove("sichtbar");
    requestAnimationFrame(function () {
      ergebnisDiv.classList.add("sichtbar");
      var label = document.createElement("span");
      label.textContent = "Score Differential";
      var wert = document.createElement("span");
      wert.className = "wert";
      wert.textContent = differential;
      ergebnisDiv.appendChild(label);
      ergebnisDiv.appendChild(wert);
    });
  }

  function zeigeFehler(nachricht) {
    ergebnisDiv.textContent = nachricht;
    ergebnisDiv.classList.remove("sichtbar");
    requestAnimationFrame(function () {
      ergebnisDiv.classList.add("sichtbar");
    });
  }

  function leereErgebnis() {
    ergebnisDiv.textContent = "";
    ergebnisDiv.classList.remove("sichtbar");
  }

  function handleSubmit(event) {
    event.preventDefault();
    leereErgebnis();

    var datum = datumInput.value && datumInput.value.trim();
    var score = parseFloat(bruttoInput.value, 10);
    var courseRating = parseFloat(courseRatingInput.value, 10);
    var slope = parseFloat(slopeInput.value, 10);

    if (!datum) {
      zeigeFehler("Bitte ein Datum angeben.");
      return;
    }
    if (isNaN(score) || isNaN(courseRating) || isNaN(slope)) {
      zeigeFehler("Bitte alle Felder mit gültigen Zahlen ausfüllen.");
      return;
    }
    if (slope <= 0) {
      zeigeFehler("Slope Rating muss größer als 0 sein.");
      return;
    }

    var differential = berechneScoreDifferential(score, courseRating, slope);
    zeigeErgebnis(differential);

    // Runde dauerhaft speichern
    var runden = ladeRunden();
    var neueRunde = {
      id: String(Date.now()),
      date: datum,
      score: score,
      courseRating: courseRating,
      slope: slope,
      differential: differential
    };
    runden.unshift(neueRunde);
    speichereRunden(runden);
    rendereRundenListe();
    aktualisiereHandicap();
  }

  // Beim Start: Datum auf heute, Liste und Handicap aus LocalStorage füllen
  setzeHeute();
  rendereRundenListe();
  aktualisiereHandicap();
  form.addEventListener("submit", handleSubmit);
  btnAlleLoeschen.addEventListener("click", alleLoeschen);
})();
