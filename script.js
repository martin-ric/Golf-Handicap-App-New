/**
 * Golf Handicap – Score Differential
 * Modular structure, validation, error handling, XSS-safe output (textContent only),
 * accessibility improvements.
 */

(function () {
  "use strict";

  // ============================================================================
  // CONFIGURATION
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
     * Validates a date string (YYYY-MM-DD format).
     * @param {string} dateString - Date string
     * @returns {{valid: boolean, error: string|null}}
     */
    validateDate: function (dateString) {
      if (!dateString || typeof dateString !== "string") {
        return { valid: false, error: "Bitte ein gültiges Datum angeben." };
      }
      var trimmed = dateString.trim();
      if (!trimmed) {
        return { valid: false, error: "Bitte ein Datum angeben." };
      }
      var regex = /^\d{4}-\d{2}-\d{2}$/;
      if (!regex.test(trimmed)) {
        return { valid: false, error: "Ungültiges Datumsformat. Bitte YYYY-MM-DD verwenden." };
      }
      var dateObj = new Date(trimmed + "T00:00:00");
      if (isNaN(dateObj.getTime())) {
        return { valid: false, error: "Ungültiges Datum." };
      }
      var today = new Date();
      today.setHours(0, 0, 0, 0);
      if (dateObj > today) {
        return { valid: false, error: "Das Datum darf nicht in der Zukunft liegen." };
      }
      return { valid: true, error: null };
    },

    /**
     * Validates gross score input.
     * @param {string|number} score - Score value
     * @returns {{valid: boolean, error: string|null, value: number|null}}
     */
    validateScore: function (score) {
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
     * Validates course rating input.
     * @param {string|number} courseRating - Course rating value
     * @returns {{valid: boolean, error: string|null, value: number|null}}
     */
    validateCourseRating: function (courseRating) {
      if (courseRating === "" || courseRating === null || courseRating === undefined) {
        return { valid: false, error: "Bitte ein Course Rating eingeben.", value: null };
      }
      var num = typeof courseRating === "string" ? parseFloat(courseRating) : Number(courseRating);
      if (isNaN(num) || !isFinite(num)) {
        return { valid: false, error: "Course Rating muss eine gültige Zahl sein.", value: null };
      }
      if (num < 50 || num > 80) {
        return { valid: false, error: "Course Rating muss zwischen 50 und 80 liegen.", value: null };
      }
      return { valid: true, error: null, value: num };
    },

    /**
     * Validates slope rating input.
     * @param {string|number} slope - Slope rating value
     * @returns {{valid: boolean, error: string|null, value: number|null}}
     */
    validateSlope: function (slope) {
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
     * Validates a round object (from storage).
     * @param {Object} round - Round object
     * @returns {{valid: boolean, error: string|null}}
     */
    validateRound: function (round) {
      if (!round || typeof round !== "object") {
        return { valid: false, error: "Ungültiges Runden-Objekt." };
      }
      var required = ["id", "date", "score", "courseRating", "slope", "differential"];
      for (var i = 0; i < required.length; i++) {
        if (!(required[i] in round)) {
          return { valid: false, error: "Runden-Objekt fehlt erforderliches Feld: " + required[i] + "." };
        }
      }
      if (typeof round.differential !== "number" || isNaN(round.differential)) {
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
     * Load rounds from localStorage with error handling.
     * @returns {Array<Object>} Array of rounds or empty array on error
     */
    loadRounds: function () {
      try {
        var raw = localStorage.getItem(CONFIG.STORAGE_KEY);
        if (!raw) return [];
        var parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) {
          console.warn("LocalStorage does not contain an array. Resetting.");
          return [];
        }
        var validated = [];
        for (var i = 0; i < parsed.length; i++) {
          var validation = ValidationService.validateRound(parsed[i]);
          if (validation.valid) {
            validated.push(parsed[i]);
          } else {
            console.warn("Invalid round skipped:", validation.error);
          }
        }
        return validated;
      } catch (e) {
        console.error("Error loading from LocalStorage:", e);
        return [];
      }
    },

    /**
     * Save rounds to localStorage with error handling.
     * @param {Array<Object>} rounds - Array of round objects
     * @returns {{success: boolean, error: string|null}}
     */
    saveRounds: function (rounds) {
      if (!Array.isArray(rounds)) {
        return { success: false, error: "Runden müssen ein Array sein." };
      }
      try {
        var json = JSON.stringify(rounds);
        localStorage.setItem(CONFIG.STORAGE_KEY, json);
        return { success: true, error: null };
      } catch (e) {
        if (e.name === "QuotaExceededError") {
          return { success: false, error: "Speicherplatz voll. Bitte alte Runden löschen." };
        }
        console.error("Error saving to LocalStorage:", e);
        return { success: false, error: "Fehler beim Speichern: " + e.message };
      }
    },

    /**
     * Delete all rounds from localStorage.
     * @returns {{success: boolean, error: string|null}}
     */
    deleteAll: function () {
      try {
        localStorage.removeItem(CONFIG.STORAGE_KEY);
        return { success: true, error: null };
      } catch (e) {
        console.error("Error deleting from LocalStorage:", e);
        return { success: false, error: "Fehler beim Löschen: " + e.message };
      }
    }
  };

  // ============================================================================
  // WHS SERVICE (World Handicap System calculations)
  // ============================================================================

  var WHSService = {
    /**
     * Calculate score differential using WHS formula.
     * Formula: (113 / Slope) * (Score - Course Rating)
     * @param {number} score - Gross score
     * @param {number} courseRating - Course rating
     * @param {number} slope - Slope rating
     * @returns {number} Score differential rounded to one decimal place
     */
    calculateScoreDifferential: function (score, courseRating, slope) {
      var scoreDifferential = (CONFIG.CONSTANT_SLOPE / slope) * (score - courseRating);
      return Math.round(scoreDifferential * 10) / 10;
    },

    /**
     * Get WHS calculation parameters based on number of rounds.
     * Implements the official WHS sliding scale.
     * @param {number} roundCount - Number of rounds available
     * @returns {{countToUse: number, adjustment: number}} Number of best rounds to use and adjustment to apply
     */
    getWHSCalculationParams: function (roundCount) {
      if (roundCount <= 0) {
        return { countToUse: 0, adjustment: 0 };
      }
      if (roundCount >= 1 && roundCount <= 3) {
        return { countToUse: 1, adjustment: -2.0 };
      }
      if (roundCount >= 4 && roundCount <= 5) {
        return { countToUse: 1, adjustment: 0 };
      }
      if (roundCount === 6) {
        return { countToUse: 2, adjustment: -1.0 };
      }
      if (roundCount >= 7 && roundCount <= 8) {
        return { countToUse: 2, adjustment: 0 };
      }
      if (roundCount >= 9 && roundCount <= 11) {
        return { countToUse: 3, adjustment: 0 };
      }
      if (roundCount >= 12 && roundCount <= 14) {
        return { countToUse: 4, adjustment: 0 };
      }
      if (roundCount >= 15 && roundCount <= 16) {
        return { countToUse: 5, adjustment: 0 };
      }
      if (roundCount >= 17 && roundCount <= 18) {
        return { countToUse: 6, adjustment: 0 };
      }
      if (roundCount === 19) {
        return { countToUse: 7, adjustment: 0 };
      }
      // 20 or more rounds
      return { countToUse: 8, adjustment: 0 };
    },

    /**
     * Calculate handicap index using official WHS sliding scale.
     * Only considers the most recent 20 rounds if more than 20 are available.
     * @param {Array<Object>} rounds - All rounds (newest first)
     * @returns {{handicap: number|null, roundsUsed: number, bestRoundsUsed: number, adjustment: number}}
     */
    calculateHandicapIndex: function (rounds) {
      if (!rounds || rounds.length === 0) {
        return { handicap: null, roundsUsed: 0, bestRoundsUsed: 0, adjustment: 0 };
      }
      
      // Take only the most recent 20 rounds
      var roundsToConsider = rounds.slice(0, CONFIG.MAX_ROUNDS_FOR_HANDICAP);
      var roundsUsed = roundsToConsider.length;
      
      // Get WHS calculation parameters based on number of rounds
      var params = this.getWHSCalculationParams(roundsUsed);
      
      if (params.countToUse === 0) {
        return { handicap: null, roundsUsed: roundsUsed, bestRoundsUsed: 0, adjustment: 0 };
      }
      
      // Sort by differential (ascending = best first)
      var sortedByDifferential = roundsToConsider.slice().sort(function (a, b) {
        return a.differential - b.differential;
      });
      
      // Take the best rounds
      var bestRounds = sortedByDifferential.slice(0, params.countToUse);
      
      // Calculate average
      var sum = bestRounds.reduce(function (acc, r) {
        return acc + r.differential;
      }, 0);
      var average = sum / params.countToUse;
      
      // Apply adjustment
      var adjustedAverage = average + params.adjustment;
      
      // Round to one decimal place
      var handicapIndex = Math.round(adjustedAverage * 10) / 10;
      
      return {
        handicap: handicapIndex,
        roundsUsed: roundsUsed,
        bestRoundsUsed: params.countToUse,
        adjustment: params.adjustment
      };
    },

    /**
     * Return handicap calculation info for display.
     * @param {Array<Object>} rounds - All rounds (newest first)
     * @returns {{handicap: number|null, roundsUsed: number, bestRoundsUsed: number, adjustment: number}}
     */
    getHandicapInfo: function (rounds) {
      return this.calculateHandicapIndex(rounds);
    }
  };

  // ============================================================================
  // UI SERVICE
  // ============================================================================

  var UIService = {
    /**
     * Format date from YYYY-MM-DD to DD.MM.YYYY.
     * @param {string} isoDate - ISO date string
     * @returns {string} Formatted date string
     */
    formatDate: function (isoDate) {
      var parts = isoDate.split("-");
      if (parts.length !== 3) return isoDate;
      return parts[2] + "." + parts[1] + "." + parts[0];
    },

    /**
     * Set today's date in a date input field.
     * @param {HTMLInputElement} input - Date input element
     */
    setToday: function (input) {
      if (!input || input.type !== "date") return;
      var today = new Date();
      var year = today.getFullYear();
      var month = String(today.getMonth() + 1).padStart(2, "0");
      var day = String(today.getDate()).padStart(2, "0");
      input.value = year + "-" + month + "-" + day;
    },

    /**
     * Show an error message (textContent only, XSS-safe).
     * @param {HTMLElement} container - Container element
     * @param {string} message - Error message
     */
    showError: function (container, message) {
      if (!container) return;
      container.textContent = "";
      container.classList.remove("visible");
      requestAnimationFrame(function () {
        container.textContent = message || "Ein Fehler ist aufgetreten.";
        container.classList.add("visible");
        container.setAttribute("role", "alert");
        container.setAttribute("aria-live", "assertive");
      });
    },

    /**
     * Show result (score differential) in container (textContent only, XSS-safe).
     * @param {HTMLElement} container - Container element
     * @param {number} scoreDifferential - Score differential value
     */
    showResult: function (container, scoreDifferential) {
      if (!container) return;
      container.textContent = "";
      container.classList.remove("visible");
      requestAnimationFrame(function () {
        container.classList.add("visible");
        container.removeAttribute("role");
        container.setAttribute("aria-live", "polite");
        var label = document.createElement("span");
        label.textContent = "Score Differential";
        var valueEl = document.createElement("span");
        valueEl.className = "value";
        valueEl.textContent = String(scoreDifferential);
        container.appendChild(label);
        container.appendChild(valueEl);
      });
    },

    /**
     * Clear the result/error container.
     * @param {HTMLElement} container - Container element
     */
    clearResult: function (container) {
      if (!container) return;
      container.textContent = "";
      container.classList.remove("visible");
      container.removeAttribute("role");
    }
  };

  // ============================================================================
  // APPLICATION (main logic)
  // ============================================================================

  var App = {
    elements: {
      form: null,
      roundDateInput: null,
      grossScoreInput: null,
      courseRatingInput: null,
      slopeInput: null,
      resultContainer: null,
      handicapValue: null,
      handicapHint: null,
      roundsList: null,
      roundsEmpty: null,
      deleteAllButton: null
    },

    /**
     * Initialize the application.
     */
    init: function () {
      this.elements.form = document.getElementById("handicap-form");
      this.elements.roundDateInput = document.getElementById("round-date");
      this.elements.grossScoreInput = document.getElementById("gross-score");
      this.elements.courseRatingInput = document.getElementById("course-rating");
      this.elements.slopeInput = document.getElementById("slope-rating");
      this.elements.resultContainer = document.getElementById("result");
      this.elements.handicapValue = document.getElementById("handicap-value");
      this.elements.handicapHint = document.getElementById("handicap-hint");
      this.elements.roundsList = document.getElementById("rounds-list");
      this.elements.roundsEmpty = document.getElementById("rounds-empty");
      this.elements.deleteAllButton = document.getElementById("delete-all");

      var missingElements = [];
      for (var key in this.elements) {
        if (!this.elements[key]) {
          missingElements.push(key);
        }
      }
      if (missingElements.length > 0) {
        console.error("Missing DOM elements:", missingElements);
        return;
      }

      this.elements.form.addEventListener("submit", this.handleSubmit.bind(this));
      this.elements.deleteAllButton.addEventListener("click", this.handleDeleteAll.bind(this));

      UIService.setToday(this.elements.roundDateInput);
      this.updateUI();
    },

    /**
     * Handle form submit.
     * @param {Event} event - Submit event
     */
    handleSubmit: function (event) {
      event.preventDefault();
      UIService.clearResult(this.elements.resultContainer);

      var dateRaw = this.elements.roundDateInput.value;
      var scoreRaw = this.elements.grossScoreInput.value;
      var courseRatingRaw = this.elements.courseRatingInput.value;
      var slopeRaw = this.elements.slopeInput.value;

      var dateValidation = ValidationService.validateDate(dateRaw);
      if (!dateValidation.valid) {
        UIService.showError(this.elements.resultContainer, dateValidation.error);
        this.elements.roundDateInput.setAttribute("aria-invalid", "true");
        this.elements.roundDateInput.focus();
        return;
      }
      this.elements.roundDateInput.removeAttribute("aria-invalid");

      var scoreValidation = ValidationService.validateScore(scoreRaw);
      if (!scoreValidation.valid) {
        UIService.showError(this.elements.resultContainer, scoreValidation.error);
        this.elements.grossScoreInput.setAttribute("aria-invalid", "true");
        this.elements.grossScoreInput.focus();
        return;
      }
      this.elements.grossScoreInput.removeAttribute("aria-invalid");

      var courseRatingValidation = ValidationService.validateCourseRating(courseRatingRaw);
      if (!courseRatingValidation.valid) {
        UIService.showError(this.elements.resultContainer, courseRatingValidation.error);
        this.elements.courseRatingInput.setAttribute("aria-invalid", "true");
        this.elements.courseRatingInput.focus();
        return;
      }
      this.elements.courseRatingInput.removeAttribute("aria-invalid");

      var slopeValidation = ValidationService.validateSlope(slopeRaw);
      if (!slopeValidation.valid) {
        UIService.showError(this.elements.resultContainer, slopeValidation.error);
        this.elements.slopeInput.setAttribute("aria-invalid", "true");
        this.elements.slopeInput.focus();
        return;
      }
      this.elements.slopeInput.removeAttribute("aria-invalid");

      var scoreDifferential = WHSService.calculateScoreDifferential(
        scoreValidation.value,
        courseRatingValidation.value,
        slopeValidation.value
      );
      UIService.showResult(this.elements.resultContainer, scoreDifferential);

      var rounds = StorageService.loadRounds();
      var newRound = {
        id: String(Date.now()),
        date: dateRaw.trim(),
        score: scoreValidation.value,
        courseRating: courseRatingValidation.value,
        slope: slopeValidation.value,
        differential: scoreDifferential
      };
      rounds.unshift(newRound);
      var saveResult = StorageService.saveRounds(rounds);
      if (!saveResult.success) {
        UIService.showError(this.elements.resultContainer, saveResult.error);
        return;
      }

      this.updateUI();
    },

    /**
     * Handle "Delete all" button click.
     */
    handleDeleteAll: function () {
      var rounds = StorageService.loadRounds();
      if (rounds.length === 0) return;
      if (!confirm("Wirklich alle gespeicherten Runden löschen?")) return;
      var deleteResult = StorageService.deleteAll();
      if (!deleteResult.success) {
        alert("Fehler beim Löschen: " + deleteResult.error);
        return;
      }
      UIService.clearResult(this.elements.resultContainer);
      this.updateUI();
    },

    /**
     * Delete a single round by id.
     * @param {string} roundId - Round id
     */
    deleteRound: function (roundId) {
      var rounds = StorageService.loadRounds().filter(function (r) {
        return r.id !== roundId;
      });
      var saveResult = StorageService.saveRounds(rounds);
      if (!saveResult.success) {
        alert("Fehler beim Löschen: " + saveResult.error);
        return;
      }
      this.updateUI();
    },

    /**
     * Update handicap display.
     */
    updateHandicap: function () {
      var rounds = StorageService.loadRounds();
      var newestFirst = rounds.slice().sort(function (a, b) {
        return b.date.localeCompare(a.date);
      });
      var info = WHSService.getHandicapInfo(newestFirst);
      if (info.handicap !== null) {
        this.elements.handicapValue.textContent = String(info.handicap);
        var hintText = "Based on your best " + info.bestRoundsUsed + " out of " + info.roundsUsed + " rounds";
        this.elements.handicapHint.textContent = hintText;
      } else {
        this.elements.handicapValue.textContent = "—";
        this.elements.handicapHint.textContent = "At least 1 round required";
      }
    },

    /**
     * Render the rounds list (textContent only, XSS-safe).
     */
    renderRoundsList: function () {
      this.elements.roundsList.textContent = "";
      var rounds = StorageService.loadRounds();
      var newestFirst = rounds.slice().sort(function (a, b) {
        return b.date.localeCompare(a.date);
      });

      this.elements.deleteAllButton.style.display = newestFirst.length > 0 ? "" : "none";

      var app = this;
      newestFirst.forEach(function (round) {
        var card = document.createElement("div");
        card.className = "round-card";
        card.setAttribute("data-id", round.id);
        card.setAttribute("role", "listitem");

        var dateSpan = document.createElement("span");
        dateSpan.className = "round-card-date";
        dateSpan.textContent = UIService.formatDate(round.date);

        var differentialSpan = document.createElement("span");
        differentialSpan.className = "round-card-differential";
        differentialSpan.textContent = "Diff. " + String(round.differential);

        var deleteButton = document.createElement("button");
        deleteButton.type = "button";
        deleteButton.className = "btn-round-delete";
        deleteButton.title = "Runde löschen";
        deleteButton.setAttribute("aria-label", "Runde vom " + UIService.formatDate(round.date) + " löschen");
        deleteButton.textContent = "×";
        deleteButton.addEventListener("click", function () {
          app.deleteRound(round.id);
        });

        var details = document.createElement("div");
        details.className = "round-card-details";
        details.textContent = "Score " + String(round.score) + " · CR " + String(round.courseRating) + " · Slope " + String(round.slope);

        card.appendChild(dateSpan);
        card.appendChild(differentialSpan);
        card.appendChild(deleteButton);
        card.appendChild(details);
        app.elements.roundsList.appendChild(card);
      });
    },

    /**
     * Update full UI (handicap + rounds list).
     */
    updateUI: function () {
      this.updateHandicap();
      this.renderRoundsList();
    }
  };

  // ============================================================================
  // START
  // ============================================================================

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () {
      App.init();
    });
  } else {
    App.init();
  }
})();
