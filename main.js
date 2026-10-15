// =====================================================
// CONTROL DE VERSIÓN (v1.2)
// =====================================================
const APP_VERSION = "1.2";

document.getElementById("page-title").textContent =
  `Robo-Mate v${APP_VERSION} - Restas Llevando`;
document.getElementById("version-badge-text").textContent = `v${APP_VERSION}`;
document.getElementById("version-footer-text").textContent = APP_VERSION;

// =====================================================
// ESTADO DEL JUEGO Y MEMORIA ANTIRREPETICIÓN
// =====================================================
let currentMethod = "NEIGHBOR"; // 'NEIGHBOR' | 'CARRY_DOWN' | 'STAIRS'
let numDigits = 2; // 2 o 3 cifras
let activeCol = "u"; // 'u' (unidades) -> 'd' (decenas) -> 'c' (centenas)
let score = 0;
let streak = 1;
let isTransitioning = false; // Evita pulsaciones dobles mientras cambia de resta
let recentProblems = []; // Historial para no repetir restas

// Datos de la resta actual
let problem = {
  min: { c: 0, d: 0, u: 0 },
  sub: { c: 0, d: 0, u: 0 },
  carryAppliedU: false,
  carryAppliedD: false,
};

const robot = document.getElementById("robo-mate");

const methodDescriptions = {
  NEIGHBOR:
    "🏠 <strong>Método Vecino Presta (Tachar arriba):</strong> Si al número de arriba no le alcanza para restar, le pide 1 decena a su vecino de la izquierda. Tachamos al vecino (se queda con 1 menos) y el nuestro suma 10.",
  CARRY_DOWN:
    "⬇️ <strong>Método Llevada Abajo (Tradicional):</strong> Si el número de arriba es más pequeño, le sumamos 10 para poder restar, y apuntamos <strong>+1 pequeñito abajo</strong> al número vecino de la izquierda.",
  STAIRS:
    "🪜 <strong>Método de la Escalera (Contar hacia arriba):</strong> En lugar de quitar, contamos cuántos escalones hay que subir desde el número de abajo hasta alcanzar al número de arriba (si es menor, subimos hasta 10 + ese número).",
};

// =====================================================
// SÍNTESIS DE VOZ DEL ROBOT
// =====================================================
function robotSpeak(text) {
  document.getElementById("robot-speech").innerHTML = text;
  if (!("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();

  const cleanText = text.replace(/<\/?[^>]+(>|$)/g, "");
  const utterance = new SpeechSynthesisUtterance(cleanText);
  utterance.lang = "es-ES";
  utterance.rate = 1.04;
  utterance.pitch = 1.15;

  utterance.onstart = () => robot.classList.add("speaking");
  utterance.onend = () => robot.classList.remove("speaking");
  utterance.onerror = () => robot.classList.remove("speaking");

  window.speechSynthesis.speak(utterance);
}

function announceVersion() {
  robotSpeak(`Estás en Robo-Mate versión ${APP_VERSION}.`);
}

function robotSalute() {
  explainCurrentStep();
}

// =====================================================
// CAMBIAR MÉTODO O NÚMERO DE CIFRAS
// =====================================================
function setMethod(methodKey, btnEl) {
  currentMethod = methodKey;
  document
    .querySelectorAll(".method-btn")
    .forEach((b) => b.classList.remove("active"));
  btnEl.classList.add("active");

  document.getElementById("method-explanation").innerHTML =
    methodDescriptions[methodKey];
  refreshVisualCarries();
  explainCurrentStep();
}

function setDigits(digits, btnEl) {
  numDigits = digits;
  document
    .querySelectorAll(".lvl-btn")
    .forEach((b) => b.classList.remove("active"));
  btnEl.classList.add("active");

  const grid = document.getElementById("math-grid");
  if (digits === 2) {
    grid.classList.add("two-digits");
  } else {
    grid.classList.remove("two-digits");
  }
  recentProblems = [];
  generateNewSubtraction();
}

// =====================================================
// GENERADOR INFINITO DE RESTAS DIFERENTES CON LLEVADAS
// =====================================================
function generateNewSubtraction() {
  isTransitioning = false;
  problem.carryAppliedU = false;
  problem.carryAppliedD = false;

  let signature = "";
  let attempts = 0;

  do {
    if (numDigits === 2) {
      problem.min.c = 0;
      problem.sub.c = 0;
      problem.min.d = Math.floor(Math.random() * 8) + 2; // 2 a 9
      problem.sub.d = Math.floor(Math.random() * (problem.min.d - 1)) + 1; // 1 a min.d - 1

      problem.min.u = Math.floor(Math.random() * 9); // 0 a 8
      problem.sub.u =
        Math.floor(Math.random() * (9 - problem.min.u)) + problem.min.u + 1; // min.u+1 a 9
    } else {
      problem.min.c = Math.floor(Math.random() * 7) + 3; // 3 a 9
      problem.sub.c = Math.floor(Math.random() * (problem.min.c - 2)) + 1; // 1 a min.c - 2

      const doubleCarry = Math.random() > 0.35;
      problem.min.u = Math.floor(Math.random() * 9); // 0 a 8
      problem.sub.u =
        Math.floor(Math.random() * (9 - problem.min.u)) + problem.min.u + 1;

      if (doubleCarry) {
        problem.min.d = Math.floor(Math.random() * 6); // 0 a 5
        problem.sub.d =
          Math.floor(Math.random() * (9 - problem.min.d)) + problem.min.d + 1;
      } else {
        problem.min.d = Math.floor(Math.random() * 5) + 4; // 4 a 8
        problem.sub.d = Math.floor(Math.random() * (problem.min.d - 2)) + 1;
      }
    }

    const totalMin = problem.min.c * 100 + problem.min.d * 10 + problem.min.u;
    const totalSub = problem.sub.c * 100 + problem.sub.d * 10 + problem.sub.u;
    signature = `${totalMin}-${totalSub}`;
    attempts++;
  } while (recentProblems.includes(signature) && attempts < 50);

  recentProblems.push(signature);
  if (recentProblems.length > 25) {
    recentProblems.shift();
  }

  // Limpiar interfaz de la libreta
  ["c", "d", "u"].forEach((col) => {
    document.getElementById(`min-${col}`).textContent = problem.min[col];
    document.getElementById(`min-${col}`).classList.remove("crossed-out");
    document.getElementById(`sub-${col}`).textContent = problem.sub[col];

    const inp = document.getElementById(`ans-${col}`);
    inp.value = "";
    inp.className = "digit-input";

    const topBubble = document.getElementById(`top-carry-${col}`);
    topBubble.textContent = "";
    topBubble.classList.remove("visible");
  });

  ["c", "d"].forEach((col) => {
    const botBubble = document.getElementById(`bot-carry-${col}`);
    botBubble.textContent = "";
    botBubble.classList.remove("visible");
  });

  document.getElementById("feedback").textContent = "";
  focusCol("u");
  robotSpeak(
    `Empezamos por las Unidades: a <strong>${problem.min.u}</strong> quítale <strong>${problem.sub.u}</strong>.`,
  );
}

// =====================================================
// ENFOQUE DE COLUMNA Y GUÍA PASO A PASO
// =====================================================
function focusCol(col) {
  if (isTransitioning) return;
  activeCol = col;
  document
    .querySelectorAll(".digit-input")
    .forEach((inp) => inp.classList.remove("active-col"));
  document.getElementById(`ans-${col}`).classList.add("active-col");

  const stepNames = {
    u: "👉 Paso 1: Columna de las <strong>UNIDADES (U)</strong> (derecha)",
    d: "👉 Paso 2: Columna de las <strong>DECENAS (D)</strong> (centro)",
    c: "👉 Paso 3: Columna de las <strong>CENTENAS (C)</strong> (izquierda)",
  };
  document.getElementById("step-prompt").innerHTML = stepNames[col];
}

// =====================================================
// BOTÓN DE LÁPIZ: APLICAR LLEVADA VISUALMENTE
// =====================================================
function applyCarryAction() {
  if (isTransitioning) return;

  if (activeCol === "u") {
    if (problem.min.u < problem.sub.u) {
      problem.carryAppliedU = true;
      refreshVisualCarries();
      explainCurrentStep();
    } else {
      robotSpeak(
        "En las unidades el número de arriba ya es mayor, ¡no hace falta llevar!",
      );
    }
  } else if (activeCol === "d" && numDigits === 3) {
    const effectiveMinD =
      currentMethod === "NEIGHBOR" && problem.carryAppliedU
        ? problem.min.d - 1
        : problem.min.d;
    const effectiveSubD =
      currentMethod !== "NEIGHBOR" && problem.carryAppliedU
        ? problem.sub.d + 1
        : problem.sub.d;

    if (effectiveMinD < effectiveSubD) {
      problem.carryAppliedD = true;
      refreshVisualCarries();
      explainCurrentStep();
    } else {
      robotSpeak(
        "En las decenas puedes restar directamente sin pedir otra llevada.",
      );
    }
  }
}

function refreshVisualCarries() {
  ["c", "d", "u"].forEach((col) => {
    document.getElementById(`min-${col}`).classList.remove("crossed-out");
    document.getElementById(`top-carry-${col}`).classList.remove("visible");
  });
  ["c", "d"].forEach((col) => {
    document.getElementById(`bot-carry-${col}`).classList.remove("visible");
  });

  if (problem.carryAppliedU) {
    const topU = document.getElementById("top-carry-u");
    topU.textContent = problem.min.u + 10;
    topU.classList.add("visible");

    if (currentMethod === "NEIGHBOR") {
      document.getElementById("min-d").classList.add("crossed-out");
      const topD = document.getElementById("top-carry-d");
      topD.textContent = problem.min.d - 1;
      topD.classList.add("visible");
    } else if (currentMethod === "CARRY_DOWN") {
      const botD = document.getElementById("bot-carry-d");
      botD.textContent = "+1";
      botD.classList.add("visible");
    }
  }

  if (problem.carryAppliedD && numDigits === 3) {
    const baseD =
      currentMethod === "NEIGHBOR" && problem.carryAppliedU
        ? problem.min.d - 1
        : problem.min.d;
    const topD = document.getElementById("top-carry-d");
    topD.textContent = baseD + 10;
    topD.classList.add("visible");

    if (currentMethod === "NEIGHBOR") {
      document.getElementById("min-c").classList.add("crossed-out");
      const topC = document.getElementById("top-carry-c");
      topC.textContent = problem.min.c - 1;
      topC.classList.add("visible");
    } else if (currentMethod === "CARRY_DOWN") {
      const botC = document.getElementById("bot-carry-c");
      botC.textContent = "+1";
      botC.classList.add("visible");
    }
  }
}

// =====================================================
// EXPLICACIÓN ORAL DEL ROBOT SEGÚN MÉTODO Y COLUMNA
// =====================================================
function explainCurrentStep() {
  if (activeCol === "u") {
    const topVal = problem.min.u + 10;
    const botVal = problem.sub.u;

    if (!problem.carryAppliedU) {
      robotSpeak(
        `Mira las Unidades: a <strong>${problem.min.u}</strong> no le podemos quitar <strong>${botVal}</strong> porque el ${problem.min.u} es más pequeño. ¡Pulsa el botón rojo <strong>"Hacer la llevada con el lápiz"</strong>!`,
      );
      return;
    }

    if (currentMethod === "NEIGHBOR") {
      robotSpeak(
        `El vecino ${problem.min.d} nos presta 1 decena y se queda en <strong>${problem.min.d - 1}</strong>. Ahora arriba tenemos <strong>${topVal}</strong> menos <strong>${botVal}</strong>. ¿Cuánto es?`,
      );
    } else if (currentMethod === "CARRY_DOWN") {
      robotSpeak(
        `Convertimos el ${problem.min.u} en <strong>${topVal}</strong> y apuntamos <strong>+1 abajo</strong> en las decenas. Ahora calcula: de ${botVal} hasta ${topVal} (o ${topVal} menos ${botVal}).`,
      );
    } else {
      robotSpeak(
        `Método Escalera: el ${problem.min.u} se convierte en <strong>${topVal}</strong>. Cuenta cuántos escalones subes desde el <strong>${botVal}</strong> hasta llegar al <strong>${topVal}</strong>.`,
      );
    }
  } else if (activeCol === "d") {
    if (currentMethod === "NEIGHBOR") {
      const currentTopD = problem.carryAppliedU
        ? problem.min.d - 1
        : problem.min.d;
      if (currentTopD < problem.sub.d) {
        if (!problem.carryAppliedD) {
          robotSpeak(
            `En las decenas nos quedó un <strong>${currentTopD}</strong> arriba y no alcanza para quitarle ${problem.sub.d}. ¡Pulsa el botón de hacer la llevada!`,
          );
        } else {
          robotSpeak(
            `Con la centena prestada, ahora tenemos <strong>${currentTopD + 10}</strong> menos <strong>${problem.sub.d}</strong>.`,
          );
        }
      } else {
        robotSpeak(
          `Como el vecino prestó 1 antes, arriba nos quedó <strong>${currentTopD}</strong>. Calcula: <strong>${currentTopD} menos ${problem.sub.d}</strong>.`,
        );
      }
    } else {
      const newBotD = problem.carryAppliedU ? problem.sub.d + 1 : problem.sub.d;
      if (problem.min.d < newBotD) {
        if (!problem.carryAppliedD) {
          robotSpeak(
            `Abajo tenemos ${problem.sub.d} + 1 de llevada = <strong>${newBotD}</strong>. Como arriba hay ${problem.min.d}, ¡pulsa el botón de hacer la llevada!`,
          );
        } else {
          robotSpeak(
            `Ahora tenemos <strong>${problem.min.d + 10}</strong> arriba y <strong>${newBotD}</strong> abajo (${problem.sub.d}+1). ¿Cuál es la diferencia?`,
          );
        }
      } else {
        robotSpeak(
          `Sumamos la llevada de abajo: ${problem.sub.d} + 1 son <strong>${newBotD}</strong>. Ahora resta: <strong>${problem.min.d} menos ${newBotD}</strong>.`,
        );
      }
    }
  } else if (activeCol === "c") {
    if (currentMethod === "NEIGHBOR") {
      const topC = problem.carryAppliedD ? problem.min.c - 1 : problem.min.c;
      robotSpeak(
        `Último paso en Centenas: arriba nos quedó <strong>${topC}</strong> menos <strong>${problem.sub.c}</strong>.`,
      );
    } else {
      const botC = problem.carryAppliedD ? problem.sub.c + 1 : problem.sub.c;
      robotSpeak(
        `Último paso en Centenas: <strong>${problem.min.c}</strong> menos <strong>${botC}</strong>.`,
      );
    }
  }
}

// =====================================================
// COMPROBACIÓN DE RESPUESTA Y AUTO-AVANCE A NUEVA RESTA
// =====================================================
function getExpectedDigit(col) {
  const totalMin = problem.min.c * 100 + problem.min.d * 10 + problem.min.u;
  const totalSub = problem.sub.c * 100 + problem.sub.d * 10 + problem.sub.u;
  const diff = totalMin - totalSub;

  if (col === "u") return diff % 10;
  if (col === "d") return Math.floor((diff % 100) / 10);
  if (col === "c") return Math.floor(diff / 100);
}

function pressNum(num) {
  if (isTransitioning) return;

  const expected = getExpectedDigit(activeCol);
  const fb = document.getElementById("feedback");
  const inp = document.getElementById(`ans-${activeCol}`);

  if (
    activeCol === "u" &&
    problem.min.u < problem.sub.u &&
    !problem.carryAppliedU
  ) {
    problem.carryAppliedU = true;
    refreshVisualCarries();
  }
  if (activeCol === "d" && numDigits === 3 && !problem.carryAppliedD) {
    const effMinD =
      currentMethod === "NEIGHBOR" && problem.carryAppliedU
        ? problem.min.d - 1
        : problem.min.d;
    const effSubD =
      currentMethod !== "NEIGHBOR" && problem.carryAppliedU
        ? problem.sub.d + 1
        : problem.sub.d;
    if (effMinD < effSubD) {
      problem.carryAppliedD = true;
      refreshVisualCarries();
    }
  }

  inp.value = num;

  if (num === expected) {
    inp.classList.add("correct-col");
    fb.style.color = "#15803d";
    fb.textContent = "✅ ¡Columna correcta!";

    if (activeCol === "u") {
      isTransitioning = true;
      setTimeout(() => {
        isTransitioning = false;
        focusCol("d");
        explainCurrentStep();
      }, 850);
    } else if (activeCol === "d") {
      if (numDigits === 3) {
        isTransitioning = true;
        setTimeout(() => {
          isTransitioning = false;
          focusCol("c");
          explainCurrentStep();
        }, 850);
      } else {
        completeSubtractionAndLoadNext();
      }
    } else if (activeCol === "c") {
      completeSubtractionAndLoadNext();
    }
  } else {
    fb.style.color = "#dc2626";
    fb.textContent = "❌ Casi... ¡Revisa la llevada y escucha a Robo-Mate!";
    explainCurrentStep();
  }
}

function completeSubtractionAndLoadNext() {
  isTransitioning = true;
  score += 15;
  streak++;
  document.getElementById("score").textContent = score;
  document.getElementById("streak").textContent = streak;

  const fb = document.getElementById("feedback");
  fb.style.color = "#15803d";
  fb.textContent = "🎉 ¡Muy bien! Cargando la siguiente...";
  robotSpeak("¡Muy bien!");

  // Pasa directamente a la siguiente resta tras decir "¡Muy bien!"
  setTimeout(() => {
    generateNewSubtraction();
  }, 1200);
}

// Inicializar juego al cargar
document.getElementById("method-explanation").innerHTML =
  methodDescriptions[currentMethod];
generateNewSubtraction();
