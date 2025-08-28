document.addEventListener('DOMContentLoaded', () => {
    // --- ELEMENTI DEL DOM ---
    const instructionTextEl = document.getElementById('instruction-text');
    const colA_El = document.getElementById('column-a');
    const colB_El = document.getElementById('column-b');
    const canvas = document.getElementById('lines-canvas');
    const ctx = canvas.getContext('2d');
    const nextBtn = document.getElementById('next-btn');
    const feedbackTextEl = document.getElementById('feedback-text');
    const scoreCountEl = document.getElementById('score-count');
    const totalPairsEl = document.getElementById('total-pairs');
    const timerEl = document.getElementById('timer');
    const modalEl = document.getElementById('end-game-modal');
    const finalScoreEl = document.getElementById('final-score');
    const finalTimeEl = document.getElementById('final-time');
    const playAgainBtn = document.getElementById('play-again-btn');
    const speakBtn = document.getElementById('speak-btn');

    // --- VARIABILI DI STATO ---
    // Le variabili gameData e gameId sono ora globali e disponibili grazie al template Python.
    // Rimuovi la loro inizializzazione qui.
    let currentLevelIndex = 0;
    let selection = { itemA: null, itemB: null };
    let score = 0;
    let matchedPairs = [];
    let timerInterval = null;
    let seconds = 0;

    // 0. Rimuovi la parte che legge i dati dello studente dall'URL
    // Non è più necessario usare URLSearchParams
    // const urlParams = new URLSearchParams(window.location.search);
    // studentInfo = { name: urlParams.get('name'), email: urlParams.get('email') };

    // 1. Funzione per mescolare un array (Fisher-Yates)
    function shuffle(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
    }

    // 2. Rimuovi la funzione loadGameData().
    // I dati sono già disponibili nella variabile globale `gameData`.

    // Funzione per la sintesi vocale (Text-to-Speech)
    function speakText(text) {
        if ('speechSynthesis' in window) {
            window.speechSynthesis.cancel();
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.lang = 'it-IT';
            window.speechSynthesis.speak(utterance);
        } else {
            alert("Il tuo browser non supporta la sintesi vocale.");
        }
    }

    // 3. Inizializza o resetta il gioco
    function initGame() {
        // La variabile globale `gameData` è già popolata dal server.
        currentLevelIndex = 0;
        score = 0;
        modalEl.style.display = 'none';
        startTimer();
        loadLevel(currentLevelIndex);
    }

    // 4. Carica un livello specifico
    function loadLevel(levelIndex) {
        const level = gameData[levelIndex];
        if (!level) {
            // Gestisci il caso in cui non ci sono più livelli
            showGameEnd();
            return;
        }

        instructionTextEl.textContent = level.instruction;

        // Reset stato del livello
        colA_El.innerHTML = '';
        colB_El.innerHTML = '';
        feedbackTextEl.textContent = '';
        nextBtn.classList.add('hidden');
        selection = { itemA: null, itemB: null };
        matchedPairs = [];
        scoreCountEl.textContent = score;
        totalPairsEl.textContent = level.pairs.length;

        // Mescola la colonna B per la casualità
        const columnB_items = level.pairs.map(p => ({ id: p.id, itemData: p.itemB }));
        shuffle(columnB_items);

        level.pairs.forEach(pair => {
            createItem(pair.id, pair.itemA, colA_El, 'A');
        });
        columnB_items.forEach(item => {
            createItem(item.id, item.itemData, colB_El, 'B');
        });

        setTimeout(resizeCanvas, 0);
    }

    // 5. Crea un singolo elemento cliccabile
    function createItem(id, itemData, columnEl, columnType) {
        const itemEl = document.createElement('div');
        itemEl.classList.add('match-item');

        if (itemData.image) {
            itemEl.style.backgroundImage = `url(${itemData.image})`;
            itemEl.classList.add('has-image');
            if (itemData.text) {
                const textOverlay = document.createElement('span');
                textOverlay.classList.add('text-overlay');
                textOverlay.textContent = itemData.text;
                itemEl.appendChild(textOverlay);
            }
        } else {
            itemEl.textContent = itemData.text;
        }

        itemEl.dataset.id = id;
        itemEl.dataset.column = columnType;
        itemEl.addEventListener('click', () => {
            if (!itemEl.classList.contains('matched')) {
                handleItemClick(itemEl);
            }
        });
        columnEl.appendChild(itemEl);
    }

    // 6. Gestisce il click su un elemento
    function handleItemClick(itemEl) {
        const column = itemEl.dataset.column;
        if (selection[`item${column}`] === itemEl) {
            itemEl.classList.remove('selected');
            selection[`item${column}`] = null;
            return;
        }
        if (selection[`item${column}`]) {
            selection[`item${column}`].classList.remove('selected');
        }
        selection[`item${column}`] = itemEl;
        itemEl.classList.add('selected');

        if (selection.itemA && selection.itemB) {
            checkMatch();
        }
    }

    // 7. Controlla se i due elementi selezionati corrispondono
    function checkMatch() {
        const itemA = selection.itemA;
        const itemB = selection.itemB;

        selection = { itemA: null, itemB: null };

        itemA.classList.remove('selected');
        itemB.classList.remove('selected');

        if (itemA.dataset.id === itemB.dataset.id) {
            itemA.classList.add('matched');
            itemB.classList.add('matched');

            matchedPairs.push({ from: itemA, to: itemB });
            drawLine(itemA, itemB, '#28a745');
            score++;
            scoreCountEl.textContent = score;

            if (matchedPairs.length === gameData[currentLevelIndex].pairs.length) {
                if (currentLevelIndex < gameData.length - 1) {
                    nextBtn.classList.remove('hidden');
                } else {
                    showGameEnd();
                }
            }
        } else {
            itemA.classList.add('incorrect-shake');
            itemB.classList.add('incorrect-shake');
            drawLine(itemA, itemB, '#dc3545');
            
            setTimeout(() => {
                itemA.classList.remove('incorrect-shake');
                itemB.classList.remove('incorrect-shake');
                redrawAllLines();
            }, 500);
        }
    }

    // 8. Funzioni per disegnare le linee sul canvas
    function getAnchorPoint(element, fromColumn) {
        const rect = element.getBoundingClientRect();
        const containerRect = canvas.getBoundingClientRect();

        const x = fromColumn === 'A' 
            ? rect.right - containerRect.left - 2
            : rect.left - containerRect.left + 2;

        const y = rect.top - containerRect.top + rect.height / 2;
        return { x, y };
    }
    function drawLine(fromEl, toEl, color) {
        const start = getAnchorPoint(fromEl, 'A');
        const end = getAnchorPoint(toEl, 'B');
        ctx.beginPath();
        ctx.moveTo(start.x, start.y);
        ctx.lineTo(end.x, end.y);
        ctx.lineWidth = 5;
        ctx.lineCap = 'round';
        ctx.strokeStyle = color;
        ctx.stroke();
    }
    function resizeCanvas() {
        canvas.width = canvas.offsetWidth;
        canvas.height = canvas.offsetHeight;
        redrawAllLines();
    }
    function redrawAllLines() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        matchedPairs.forEach(pair => {
            drawLine(pair.from, pair.to, '#28a745');
        });
    }

    // 9. Avvia e gestisce il timer
    function startTimer() {
        clearInterval(timerInterval);
        seconds = 0;
        timerEl.textContent = '00:00';
        timerInterval = setInterval(() => {
            seconds++;
            const mins = Math.floor(seconds / 60).toString().padStart(2, '0');
            const secs = (seconds % 60).toString().padStart(2, '0');
            timerEl.textContent = `${mins}:${secs}`;
        }, 1000);
    }

    // 10. Mostra la schermata di fine gioco
    function showGameEnd() {
        clearInterval(timerInterval);
        finalScoreEl.textContent = score;
        finalTimeEl.textContent = timerEl.textContent;

        sendResultsToServer();
        setTimeout(() => modalEl.style.display = 'flex', 1000);
    }

    // 11. Invia i risultati al server (funzione modificata)
    async function sendResultsToServer() {
        const studentName = prompt("Complimenti! Inserisci il tuo nome per inviare i risultati all'insegnante:");
        const studentEmail = prompt("Ora inserisci la tua email:");

        if (!studentName || !studentEmail) {
            alert("Risultati non inviati. I campi sono obbligatori.");
            return;
        }

        const totalPairsInGame = gameData.reduce((total, level) => total + level.pairs.length, 0);

        const payload = {
            name: studentName,
            email: studentEmail,
            score: `${score} / ${totalPairsInGame}`,
            time: timerEl.textContent,
        };

        try {
            // L'ID del gioco viene preso dalla variabile globale `gameId`
            const response = await fetch(`/api/submit_result/${gameId}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                throw new Error('Errore durante l\'invio dei risultati.');
            }

            const result = await response.json();
            if (result.status === 'success') {
                alert("Risultati inviati con successo all'insegnante!");
            } else {
                alert(`Errore nell'invio dei risultati: ${result.message}`);
            }

        } catch (error) {
            console.error("Errore nell'invio dei risultati:", error);
            alert("Errore di rete. Impossibile inviare i risultati.");
        }
    }

    // 12. Event listeners
    nextBtn.addEventListener('click', () => {
        currentLevelIndex++;
        if (currentLevelIndex < gameData.length) {
            loadLevel(currentLevelIndex);
        }
    });
    playAgainBtn.addEventListener('click', initGame);
    window.addEventListener('resize', resizeCanvas);
    speakBtn.addEventListener('click', () => {
        const textToSpeak = instructionTextEl.textContent;
        if (textToSpeak) speakText(textToSpeak);
    });

    // 13. Avvia il gioco
    // Usa la variabile globale `gameData` per inizializzare il gioco
    if (typeof gameData !== 'undefined' && gameData.length > 0) {
        initGame();
    } else {
        instructionTextEl.textContent = "Errore: dati del gioco non disponibili.";
    }
});