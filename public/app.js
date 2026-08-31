const PAIRS = [
  {
    number: 1,
    a: "videos/billy-jean.mp4",
    b: "videos/v-billy-jean.mp4",
  },
  {
    number: 2,
    a: "videos/fussball.mp4",
    b: "videos/v-fussball.mp4",
  },
  {
    number: 3,
    a: "videos/v-outfit.mp4",
    b: "videos/outfit.mp4",
  },
  {
    number: 4,
    a: "videos/politik.mp4",
    b: "videos/v-politik.mp4",
  },
  {
    number: 5,
    a: "videos/v-procrastination.mp4",
    b: "videos/procrastination.mp4",
  },
  {
    number: 6,
    a: "videos/v-rain.mp4",
    b: "videos/rain.mp4",
  },
  {
    number: 7,
    a: "videos/v-raise-hand.mp4",
    b: "videos/raise-hand.mp4",
  },
  {
    number: 8,
    a: "videos/rapunzel.mp4",
    b: "videos/v-rapunzel.mp4",
  },
  {
    number: 9,
    a: "videos/sonne.mp4",
    b: "videos/v-sonne.mp4",
  },
  {
    number: 10,
    a: "videos/v-sonnenfinsternis.mp4",
    b: "videos/sonnenfinsternis.mp4",
  },
];

const pairsContainer = document.getElementById("pairs");
const form = document.getElementById("surveyForm");
const progressText = document.getElementById("progressText");
const status = document.getElementById("status");
const submitButton = document.getElementById("submitButton");

function renderPairs() {
  pairsContainer.innerHTML = PAIRS.map(
    (pair) => `
    <section class="card pair-card">
      <div class="pair-heading">
        <div>
          <div class="pair-number">Videopaar ${pair.number} von 10</div>
          <h2>Welches Video würdest du eher als viral einschätzen?</h2>
          <p class="question-help">Wähle genau eines der beiden Videos aus.</p>
        </div>
      </div>

      <div class="video-grid">
        ${renderVideo(pair, "A", pair.a)}
        ${renderVideo(pair, "B", pair.b)}
      </div>

      <label class="reason-field">
        <span>Warum hast du dich dafür entschieden? <b>*</b></span>
        <textarea
          name="reason${pair.number}"
          data-reason="pair${pair.number}"
          rows="3"
          maxlength="500"
          placeholder="Erkläre kurz, was dir aufgefallen ist …"
          required
        ></textarea>
      </label>
    </section>
  `,
  ).join("");

  document.querySelectorAll('input[type="radio"]').forEach((input) => {
    input.addEventListener("change", updateProgress);
  });
  updateProgress();
}

function renderVideo(pair, option, src) {
  const id = `pair${pair.number}-${option}`;
  return `
    <div class="video-option" data-option="${option}">
      <input id="${id}" type="radio" name="pair${pair.number}" value="${option}" required>
      <label for="${id}">
        <video controls preload="metadata" playsinline>
          <source src="${src}" type="video/mp4">
          Dein Browser kann dieses Video nicht abspielen.
        </video>
        <div class="video-caption">
          <span class="radio-dot" aria-hidden="true"></span>
          <span class="choice-text">Video ${option} auswählen</span>
        </div>
      </label>
    </div>
  `;
}

function updateProgress() {
  const answered = PAIRS.filter((pair) =>
    document.querySelector(`input[name="pair${pair.number}"]:checked`),
  ).length;
  progressText.textContent = `${answered} von 10 Videopaaren beantwortet.`;

  document.querySelectorAll(".video-option").forEach((card) => {
    const input = card.querySelector("input");
    card.classList.toggle("selected", input.checked);
  });
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  status.textContent = "";

  if (!form.checkValidity()) {
    form.reportValidity();
    status.textContent =
      "Bitte fülle alle Pflichtfelder aus und beantworte alle 10 Videopaare.";
    return;
  }

  const answers = {};
  PAIRS.forEach((pair) => {
    answers[`pair${pair.number}`] = document.querySelector(
      `input[name="pair${pair.number}"]:checked`,
    ).value;

    answers[`pair${pair.number}_reason`] = document
      .querySelector(`textarea[data-reason="pair${pair.number}"]`)
      .value.trim();
  });

  submitButton.disabled = true;
  submitButton.textContent = "Wird gesendet …";

  try {
    const response = await fetch("/api/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: document.getElementById("name").value,
        ageGroup: document.getElementById("ageGroup").value,
        gender: document.getElementById("gender").value,
        answers,
      }),
    });

    const result = await response.json();
    if (!response.ok || !result.ok)
      throw new Error(result.message || "Unbekannter Fehler");

    form.hidden = true;
    document.querySelector(".intro").hidden = true;
    document.getElementById("success").hidden = false;
    window.scrollTo({ top: 0, behavior: "smooth" });
  } catch (error) {
    console.error(error);
    status.textContent =
      "Leider hat das Senden nicht funktioniert. Bitte versuche es noch einmal.";
    submitButton.disabled = false;
    submitButton.textContent = "Umfrage absenden";
  }
});

renderPairs();
