/**
 * Golf Handicap – Score Differential
 * Berechnet das Score Differential nach der Formel:
 * (113 / Slope) * (Brutto-Score - Course Rating)
 */

(function () {
  "use strict";

  // Referenzen zu den HTML-Elementen holen
  var form = document.getElementById("handicap-form");
  var bruttoInput = document.getElementById("brutto-score");
  var courseRatingInput = document.getElementById("course-rating");
  var slopeInput = document.getElementById("slope-rating");
  var ergebnisDiv = document.getElementById("ergebnis");

  /**
   * Berechnet das Score Differential.
   * Formel: (113 / Slope) * (Score - Course Rating)
   * @param {number} score - Brutto-Score (Anzahl Schläge)
   * @param {number} courseRating - Course Rating des Platzes
   * @param {number} slope - Slope Rating des Platzes
   * @returns {number} Score Differential (auf eine Dezimalstelle gerundet)
   */
  function berechneScoreDifferential(score, courseRating, slope) {
    var differential = (113 / slope) * (score - courseRating);
    return Math.round(differential * 10) / 10;
  }

  /**
   * Zeigt das Ergebnis in der Ergebnis-Box an.
   * @param {number} differential - Berechnetes Score Differential
   */
  function zeigeErgebnis(differential) {
    ergebnisDiv.textContent = "";
    ergebnisDiv.classList.add("sichtbar");
    var label = document.createElement("span");
    label.textContent = "Score Differential: ";
    var wert = document.createElement("span");
    wert.className = "wert";
    wert.textContent = differential;
    ergebnisDiv.appendChild(label);
    ergebnisDiv.appendChild(wert);
  }

  /**
   * Zeigt eine Fehlermeldung an (z.B. ungültige Eingaben).
   * @param {string} nachricht - Fehlermeldung
   */
  function zeigeFehler(nachricht) {
    ergebnisDiv.textContent = nachricht;
    ergebnisDiv.classList.add("sichtbar");
  }

  /**
   * Leert die Ergebnis-Box und entfernt die sichtbare Hervorhebung.
   */
  function leereErgebnis() {
    ergebnisDiv.textContent = "";
    ergebnisDiv.classList.remove("sichtbar");
  }

  /**
   * Wird ausgeführt, wenn das Formular abgeschickt wird.
   * Liest die Eingaben, prüft sie und startet die Berechnung.
   */
  function handleSubmit(event) {
    event.preventDefault();
    leereErgebnis();

    // Werte aus den Eingabefeldern lesen (als Zahl)
    var score = parseFloat(bruttoInput.value, 10);
    var courseRating = parseFloat(courseRatingInput.value, 10);
    var slope = parseFloat(slopeInput.value, 10);

    // Einfache Plausibilitätsprüfung
    if (isNaN(score) || isNaN(courseRating) || isNaN(slope)) {
      zeigeFehler("Bitte alle Felder mit gültigen Zahlen ausfüllen.");
      return;
    }
    if (slope <= 0) {
      zeigeFehler("Slope Rating muss größer als 0 sein.");
      return;
    }

    // Berechnung durchführen und Ergebnis anzeigen
    var differential = berechneScoreDifferential(score, courseRating, slope);
    zeigeErgebnis(differential);
  }

  // Formular beim Absenden an die Funktion binden
  form.addEventListener("submit", handleSubmit);
})();
