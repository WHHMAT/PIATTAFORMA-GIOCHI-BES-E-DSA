document.addEventListener('DOMContentLoaded', () => {
    // --- DATI DEL GIOCO ---
    // Questi dati verranno caricati da data.json
    let gameData = []; 

    // --- ELEMENTI DEL DOM ---
    const instructionTextEl = document.getElementById('instruction-text');
    const gridEl = document.getElementById('memory-grid');
    const movesCountEl = document.getElementById('moves-count');
    const timerEl = document.getElementById('timer');
    const modalEl = document.getElementById('end-game-modal');
    const finalMovesEl = document.getElementById('final-moves');
    const finalTimeEl = document.getElementById('final-time');
    const playAgainBtn = document.getElementById('play-again-btn');
    const speakBtn = document.getElementById('speak-btn'); // Pulsante TTS

    // --- VARIABILI DI STATO ---
    let moves = 0;
    let timerInterval = null;
    let seconds = 0;
    let flippedCards = [];
    let matchedPairs = 0;
    let totalPairs = 0;
    let isChecking = false; // Per prevenire click durante il controllo
    let studentInfo = {};

    // 0. Recupera i dati dello studente dall'URL
    const urlParams = new URLSearchParams(window.location.search);
    studentInfo = { name: urlParams.get('name'), email: urlParams.get('email') };

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

    // 1. Carica i dati del gioco dal file JSON
    async function loadGameData() {
        try {
            const response = await fetch('data.json');
            if (!response.ok) throw new Error(`Errore HTTP: ${response.status}`);
            const data = await response.json();
            gameData = data.cards; // Assumiamo che data.json abbia una chiave "cards"
            instructionTextEl.textContent = data.instruction || "Trova le coppie!";
            initGame();
        } catch (error) {
            console.error("Errore nel caricamento di data.json:", error);
            instructionTextEl.textContent = "Errore: impossibile caricare i dati del gioco.";
        }
    }

    // 2. Inizializza o resetta il gioco
    function initGame() {
        moves = 0;
        seconds = 0;
        matchedPairs = 0;
        totalPairs = gameData.length;
        movesCountEl.textContent = moves;
        modalEl.style.display = 'none';
        gridEl.innerHTML = '';
        
        createBoard();
        startTimer();
    }

    // 3. Crea il tabellone di gioco
    function createBoard() {
        const cardValues = [...gameData, ...gameData]; // Duplica le carte per creare le coppie
        cardValues.sort(() => Math.random() - 0.5); // Mescola

        gridEl.style.gridTemplateColumns = `repeat(${Math.ceil(Math.sqrt(cardValues.length))}, 1fr)`;

        cardValues.forEach(value => {
            const cardEl = document.createElement('div');
            cardEl.classList.add('card');
            cardEl.dataset.value = value;
            
            const cardInner = document.createElement('div');
            cardInner.classList.add('card-inner');

            const cardFront = document.createElement('div');
            cardFront.classList.add('card-front');

            const cardBack = document.createElement('div');
            cardBack.classList.add('card-back');
            cardBack.textContent = value; // Mostra il valore sul retro

            cardInner.appendChild(cardFront);
            cardInner.appendChild(cardBack);
            cardEl.appendChild(cardInner);

            cardEl.addEventListener('click', () => handleCardClick(cardEl));
            gridEl.appendChild(cardEl);
        });
    }

    // 4. Gestisce il click su una carta
    function handleCardClick(cardEl) {
        if (isChecking || cardEl.classList.contains('flipped') || cardEl.classList.contains('matched')) {
            return;
        }

        cardEl.classList.add('flipped');
        flippedCards.push(cardEl);

        if (flippedCards.length === 2) {
            moves++;
            movesCountEl.textContent = moves;
            isChecking = true;
            checkForMatch();
        }
    }

    // 5. Controlla se le due carte girate sono una coppia
    function checkForMatch() {
        const [card1, card2] = flippedCards;
        if (card1.dataset.value === card2.dataset.value) {
            // È una coppia
            card1.classList.add('matched');
            card2.classList.add('matched');
            matchedPairs++;
            flippedCards = [];
            isChecking = false;
            if (matchedPairs === totalPairs) {
                setTimeout(showGameEnd, 500);
            }
        } else {
            // Non è una coppia
            setTimeout(() => {
                card1.classList.remove('flipped');
                card2.classList.remove('flipped');
                flippedCards = [];
                isChecking = false;
            }, 1000);
        }
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

    // 7. Mostra la schermata di fine gioco
    function showGameEnd() {
        clearInterval(timerInterval);
        finalMovesEl.textContent = moves;
        finalTimeEl.textContent = timerEl.textContent;

        sendResultsToServer(); // Invia i risultati

        modalEl.style.display = 'flex';
    }

    // 8. Invia i risultati al server
    async function sendResultsToServer() {
        if (!studentInfo.name || !studentInfo.email) {
            console.log("Dati studente non trovati, invio email saltato.");
            return;
        }
        const projectName = window.location.pathname.split('/')[2];
        const payload = { ...studentInfo, score: `Mosse: ${moves}`, time: timerEl.textContent };

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

    // 9. Event listeners
    playAgainBtn.addEventListener('click', loadGameData);
    speakBtn.addEventListener('click', () => speakText(instructionTextEl.textContent));

    // 10. Avvia il gioco
    loadGameData();
});
