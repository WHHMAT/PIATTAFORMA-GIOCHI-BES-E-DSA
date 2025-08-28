document.addEventListener('DOMContentLoaded', () => {
    // --- ELEMENTI DEL DOM ---
    const instructionTextEl = document.getElementById('instruction-text');
    const mazeContainerEl = document.getElementById('maze-container');
    const movesCountEl = document.getElementById('moves-count');
    const timerEl = document.getElementById('timer');
    const modalEl = document.getElementById('end-game-modal');
    const finalMovesEl = document.getElementById('final-moves');
    const finalTimeEl = document.getElementById('final-time');
    const playAgainBtn = document.getElementById('play-again-btn');
    const controls = document.getElementById('controls');
    const speakBtn = document.getElementById('speak-btn');

    // --- VARIABILI DI STATO ---
    let gameData = [];
    let currentLevelIndex = 0;
    let currentLayout = [];
    let player = { x: 0, y: 0 };
    let playerEl = null;
    let moves = 0;
    let timerInterval = null;
    let seconds = 0;
    let isGameOver = false;
    let studentInfo = {};
    const CELL_SIZE = 40;

    // 0. Le variabili `gameData` e `gameId` sono ora globali e disponibili
    //    Non è più necessario recuperare i dati dall'URL.
    //    Rimuoviamo questa parte: `const urlParams = new URLSearchParams(window.location.search);`
    //    e `studentInfo = { name: urlParams.get('name'), email: urlParams.get('email') };`
    //    Poiché i dati dello studente vengono richiesti alla fine del gioco.

    // 1. Inizializzazione del gioco (ora usa direttamente la variabile globale `gameData`)
    function initGame() {
        moves = 0;
        isGameOver = false;
        movesCountEl.textContent = moves;
        modalEl.style.display = 'none';
        controls.style.visibility = 'visible';

        // L'oggetto `gameData` è già disponibile globalmente.
        if (currentLevelIndex < gameData.levels.length) { // MODIFICA: usa `gameData.levels`
            loadLevel(currentLevelIndex);
            startTimer();
        } else {
            // Se tutti i livelli sono stati completati
            currentLevelIndex = 0;
            loadLevel(currentLevelIndex);
            startTimer();
            playAgainBtn.textContent = 'Gioca Ancora';
            document.querySelector('#end-game-modal h2').textContent = 'Hai completato tutti i labirinti!';
        }
    }

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

    // 2. Carica un livello specifico
    function loadLevel(levelIndex) {
        if (!gameData.levels[levelIndex]) { // MODIFICA: usa `gameData.levels`
            instructionTextEl.textContent = "Hai completato tutti i livelli!";
            mazeContainerEl.innerHTML = '';
            // Invia i risultati se tutti i livelli sono stati completati
            sendResultsToServer('Tutti i livelli completati'); 
            return;
        }

        mazeContainerEl.innerHTML = '';
        const level = gameData.levels[levelIndex]; // MODIFICA: usa `gameData.levels`
        currentLayout = level.layout;
        if (!level || !currentLayout || currentLayout.length === 0) {
            console.error(`Layout non trovato o vuoto per il livello ${levelIndex}`);
            instructionTextEl.textContent = "Errore: dati del livello corrotti.";
            return;
        }
        instructionTextEl.textContent = gameData.levels[levelIndex].instruction; // MODIFICA: usa `gameData.levels`

        const rows = currentLayout.length;
        const cols = currentLayout[0].length;
        mazeContainerEl.style.gridTemplateColumns = `repeat(${cols}, ${CELL_SIZE}px)`;
        mazeContainerEl.style.width = `${cols * CELL_SIZE}px`;
        mazeContainerEl.style.height = `${rows * CELL_SIZE}px`;

        currentLayout.forEach((row, y) => {
            row.forEach((cellType, x) => {
                const cellEl = document.createElement('div');
                cellEl.classList.add('cell', cellType);
                if (cellType === 'end') cellEl.textContent = '⭐';
                mazeContainerEl.appendChild(cellEl);
                if (cellType === 'start') {
                    player.x = x;
                    player.y = y;
                }
            });
        });
        createPlayer();
    }

    // 3. Crea l'elemento del giocatore e lo posiziona
    function createPlayer() {
        playerEl = document.createElement('div');
        playerEl.id = 'player';
        mazeContainerEl.appendChild(playerEl);
        updatePlayerPosition();
    }

    // 4. Aggiorna la posizione CSS del giocatore
    function updatePlayerPosition() {
        playerEl.style.top = `${player.y * CELL_SIZE}px`;
        playerEl.style.left = `${player.x * CELL_SIZE}px`;
    }

    // 5. Avvia e gestisce il timer
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

    // 6. Gestisce il movimento del giocatore
    function movePlayer(dx, dy) {
        if (isGameOver) return;

        const newX = player.x + dx;
        const newY = player.y + dy;

        if (newY < 0 || newY >= currentLayout.length || newX < 0 || newX >= currentLayout[0].length) {
            return;
        }

        const targetCell = currentLayout[newY][newX];
        if (targetCell === 'wall') return;

        player.x = newX;
        player.y = newY;
        updatePlayerPosition();
        moves++;
        movesCountEl.textContent = moves;

        if (targetCell === 'end') {
            showGameEnd();
        }
    }

    // 7. Mostra la schermata di fine gioco
    function showGameEnd() {
        isGameOver = true;
        clearInterval(timerInterval);
        controls.style.visibility = 'hidden';

        currentLevelIndex++;
        finalMovesEl.textContent = moves;
        finalTimeEl.textContent = timerEl.textContent;

        if (currentLevelIndex < gameData.levels.length) {
            playAgainBtn.textContent = 'Prossimo Livello';
            document.querySelector('#end-game-modal h2').textContent = `Livello ${currentLevelIndex} completato!`;
            // Non inviamo i risultati a ogni livello, solo alla fine di tutti i livelli
        } else {
            playAgainBtn.textContent = 'Ricomincia da capo';
            document.querySelector('#end-game-modal h2').textContent = 'Hai completato tutti i labirinti!';
            sendResultsToServer('Tutti i livelli completati');
        }

        setTimeout(() => {
            modalEl.style.display = 'flex';
        }, 500);
    }

    // 8. Invia i risultati al server (MODIFICATA)
    async function sendResultsToServer(status) {
        // Chiedi i dati allo studente solo alla fine
        const studentName = prompt("Complimenti! Inserisci il tuo nome per inviare i risultati all'insegnante:");
        const studentEmail = prompt("Ora inserisci la tua email:");

        if (!studentName || !studentEmail) {
            alert("Risultati non inviati. I campi sono obbligatori.");
            return;
        }

        const payload = {
            name: studentName,
            email: studentEmail,
            score: `Livelli completati: ${gameData.levels.length}. Mosse totali: ${moves}`,
            time: finalTimeEl.textContent,
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

    // 9. Event listeners per i controlli
    document.getElementById('up-btn').addEventListener('click', () => movePlayer(0, -1));
    document.getElementById('down-btn').addEventListener('click', () => movePlayer(0, 1));
    document.getElementById('left-btn').addEventListener('click', () => movePlayer(-1, 0));
    document.getElementById('right-btn').addEventListener('click', () => movePlayer(1, 0));
    playAgainBtn.addEventListener('click', initGame);
    speakBtn.addEventListener('click', () => {
        const textToSpeak = instructionTextEl.textContent;
        if (textToSpeak) speakText(textToSpeak);
    });

    document.addEventListener('keydown', (e) => {
        switch (e.key) {
            case 'ArrowUp': e.preventDefault(); movePlayer(0, -1); break;
            case 'ArrowDown': e.preventDefault(); movePlayer(0, 1); break;
            case 'ArrowLeft': e.preventDefault(); movePlayer(-1, 0); break;
            case 'ArrowRight': e.preventDefault(); movePlayer(1, 0); break;
        }
    });

    // Avvia il gioco usando la variabile globale `gameData`
    if (typeof gameData !== 'undefined' && gameData.levels) {
        initGame();
    } else {
        instructionTextEl.textContent = "Errore: dati del gioco non disponibili.";
    }
});