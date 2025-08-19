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
    const speakBtn = document.getElementById('speak-btn'); // Nuovo pulsante

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
    const CELL_SIZE = 40; // Deve corrispondere al CSS

    // 0. Recupera i dati dello studente dall'URL
    const urlParams = new URLSearchParams(window.location.search);
    studentInfo = { name: urlParams.get('name'), email: urlParams.get('email') };

    // 1. Carica i dati del gioco dal file JSON
    async function loadGameData() {
        try {
            const response = await fetch('data.json');
            if (!response.ok) throw new Error(`Errore HTTP: ${response.status}`);
            gameData = await response.json();
            initGame();
        } catch (error) {
            console.error("Errore nel caricamento di data.json:", error);
            instructionTextEl.textContent = "Errore: impossibile caricare i dati del gioco.";
        }
    }

    // Funzione per la sintesi vocale (Text-to-Speech)
    function speakText(text) {
        if ('speechSynthesis' in window) {
            // Ferma qualsiasi discorso precedente per evitare sovrapposizioni
            window.speechSynthesis.cancel();
            
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.lang = 'it-IT'; // Imposta la lingua italiana
            window.speechSynthesis.speak(utterance);
        } else {
            alert("Il tuo browser non supporta la sintesi vocale.");
        }
    }

   // 2. Inizializza o resetta il gioco
function initGame() {
    moves = 0;
    isGameOver = false;
    movesCountEl.textContent = moves;
    modalEl.style.display = 'none';
    controls.style.visibility = 'visible';

    // Controlla se ci sono ancora livelli da giocare
    if (currentLevelIndex < gameData.length) {
        loadLevel(currentLevelIndex);
        startTimer();
    } else {
        // Se tutti i livelli sono stati completati, resetta e ricomincia
        currentLevelIndex = 0;
        loadLevel(currentLevelIndex);
        startTimer();
        // Resetta i testi a quelli iniziali
        playAgainBtn.textContent = 'Gioca Ancora';
        document.querySelector('#end-game-modal h2').textContent = 'Ce l\'hai fatta!';
    }
}

    // 3. Carica un livello specifico
    function loadLevel(levelIndex) {
        if (!gameData[levelIndex]) {
            instructionTextEl.textContent = "Hai completato tutti i livelli!";
            mazeContainerEl.innerHTML = '';
            return;
        }

        mazeContainerEl.innerHTML = '';
        const level = gameData[levelIndex];
        currentLayout = level.layout;
        if (!level || !currentLayout || currentLayout.length === 0) {
            console.error(`Layout non trovato o vuoto per il livello ${levelIndex}`);
            instructionTextEl.textContent = "Errore: dati del livello corrotti.";
            return;
        }
        instructionTextEl.textContent = gameData[levelIndex].instruction;

        // Imposta le dimensioni della griglia del labirinto
        const rows = currentLayout.length;
        const cols = currentLayout[0].length;
        mazeContainerEl.style.gridTemplateColumns = `repeat(${cols}, ${CELL_SIZE}px)`;
        mazeContainerEl.style.width = `${cols * CELL_SIZE}px`;
        mazeContainerEl.style.height = `${rows * CELL_SIZE}px`;

        // Crea le celle del labirinto
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

    // 4. Crea l'elemento del giocatore e lo posiziona
    function createPlayer() {
        playerEl = document.createElement('div');
        playerEl.id = 'player';
        mazeContainerEl.appendChild(playerEl);
        updatePlayerPosition();
    }

    // 5. Aggiorna la posizione CSS del giocatore
    function updatePlayerPosition() {
        playerEl.style.top = `${player.y * CELL_SIZE}px`;
        playerEl.style.left = `${player.x * CELL_SIZE}px`;
    }

    // 6. Avvia e gestisce il timer
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

    // 7. Gestisce il movimento del giocatore
    function movePlayer(dx, dy) {
        if (isGameOver) return;

        const newX = player.x + dx;
        const newY = player.y + dy;

        // Controllo dei confini del labirinto
        if (newY < 0 || newY >= currentLayout.length || newX < 0 || newX >= currentLayout[0].length) {
            return;
        }

        // Controllo dei muri
        const targetCell = currentLayout[newY][newX];
        if (targetCell === 'wall') return;

        // Il movimento è valido
        player.x = newX;
        player.y = newY;
        updatePlayerPosition();
        moves++;
        movesCountEl.textContent = moves;

        // Controllo della condizione di vittoria
        if (targetCell === 'end') {
            showGameEnd();
        }
    }

 // 8. Mostra la schermata di fine gioco
function showGameEnd() {
    isGameOver = true;
    clearInterval(timerInterval);
    controls.style.visibility = 'hidden';

    // Incrementa l'indice del livello per preparare il prossimo
    currentLevelIndex++;

    finalMovesEl.textContent = moves;
    finalTimeEl.textContent = timerEl.textContent;

    sendResultsToServer(); // Invia i risultati

    // Controlla se ci sono altri livelli da giocare
    if (currentLevelIndex < gameData.length) {
        // Se ci sono altri livelli, cambia il testo del pulsante
        playAgainBtn.textContent = 'Prossimo Livello';
        // Aggiorna anche il titolo del modale per renderlo più dinamico
        document.querySelector('#end-game-modal h2').textContent = `Livello ${currentLevelIndex} completato!`;
    } else {
        // Se tutti i livelli sono stati completati, mostra il testo finale
        playAgainBtn.textContent = 'Ricomincia da capo';
        document.querySelector('#end-game-modal h2').textContent = 'Hai completato tutti i labirinti!';
    }

    setTimeout(() => {
        modalEl.style.display = 'flex';
    }, 500);
}

    // 9. Invia i risultati al server
    async function sendResultsToServer() {
        // Invia solo se nome e email sono presenti
        if (!studentInfo.name || !studentInfo.email) {
            console.log("Dati studente non trovati, invio email saltato.");
            return;
        }

        const pathParts = window.location.pathname.split('/');
        const projectName = pathParts[pathParts.length - 2];
        const payload = {
            ...studentInfo,
            score: `Mosse: ${moves}`, // Per il labirinto, il "punteggio" sono le mosse
            time: timerEl.textContent,
        };

        try {
            await fetch(`/api/submit_result/${projectName}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
        } catch (error) {
            console.error("Errore nell'invio dei risultati:", error);
        }
    }

    // 10. Event listeners per i controlli
    document.getElementById('up-btn').addEventListener('click', () => movePlayer(0, -1));
    document.getElementById('down-btn').addEventListener('click', () => movePlayer(0, 1));
    document.getElementById('left-btn').addEventListener('click', () => movePlayer(-1, 0));
    document.getElementById('right-btn').addEventListener('click', () => movePlayer(1, 0));
    playAgainBtn.addEventListener('click', initGame);
    // Aggiunge l'evento al nuovo pulsante per leggere le istruzioni
    speakBtn.addEventListener('click', () => {
        const textToSpeak = instructionTextEl.textContent;
        if (textToSpeak) speakText(textToSpeak);
    });

    // Aggiunge il supporto per la tastiera
    document.addEventListener('keydown', (e) => {
        switch (e.key) {
            case 'ArrowUp': e.preventDefault(); movePlayer(0, -1); break;
            case 'ArrowDown': e.preventDefault(); movePlayer(0, 1); break;
            case 'ArrowLeft': e.preventDefault(); movePlayer(-1, 0); break;
            case 'ArrowRight': e.preventDefault(); movePlayer(1, 0); break;
        }
    });

    // 11. Avvia il gioco
    loadGameData();
});