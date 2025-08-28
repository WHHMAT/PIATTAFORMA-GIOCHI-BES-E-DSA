document.addEventListener('DOMContentLoaded', () => {
    // --- ELEMENTI DEL DOM ---
    const instructionTextEl = document.getElementById('instruction-text');
    const sequenceContainerEl = document.getElementById('sequence-container');
    const optionsContainerEl = document.getElementById('options-container');
    const feedbackTextEl = document.getElementById('feedback-text');
    const nextBtn = document.getElementById('next-btn');
    const scoreCountEl = document.getElementById('score-count');
    const timerEl = document.getElementById('timer');
    const modalEl = document.getElementById('end-game-modal');
    const finalScoreEl = document.getElementById('final-score');
    const totalLevelsEl = document.getElementById('total-levels');
    const finalTimeEl = document.getElementById('final-time');
    const playAgainBtn = document.getElementById('play-again-btn');
    const speakBtn = document.getElementById('speak-btn'); // Pulsante TTS

    // --- VARIABILI DI STATO ---
    let currentLevelIndex = 0;
    let score = 0;
    let timerInterval = null;
    let seconds = 0;

    // 0. Le variabili `gameData` e `gameId` sono ora globali e disponibili
    //    Rimuovi il recupero dei dati dello studente dall'URL.
    //    const urlParams = new URLSearchParams(window.location.search);
    //    studentInfo = { name: urlParams.get('name'), email: urlParams.get('email') };

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

    // 1. Rimuovi la funzione loadGameData()
    //    Il gioco userà direttamente la variabile `gameData` passata dal server.
    //    async function loadGameData() { ... }

    // 2. Inizializza o resetta il gioco
    function initGame() {
        currentLevelIndex = 0;
        score = 0;
        scoreCountEl.textContent = score;
        modalEl.style.display = 'none';
        
        // Controlla se `gameData` esiste prima di caricarlo
        if (typeof gameData !== 'undefined' && gameData.length > 0) {
            loadLevel(currentLevelIndex);
            startTimer();
        } else {
            instructionTextEl.textContent = "Errore: impossibile caricare i dati del gioco.";
        }
    }

    // 3. Carica un livello specifico
    function loadLevel(levelIndex) {
        // Pulisce lo stato precedente
        sequenceContainerEl.innerHTML = '';
        optionsContainerEl.innerHTML = '';
        optionsContainerEl.classList.remove('disabled');
        feedbackTextEl.textContent = '';
        feedbackTextEl.className = '';
        nextBtn.classList.add('hidden');

        const currentLevel = gameData[levelIndex];
        instructionTextEl.textContent = currentLevel.instruction;

        // Mostra la sequenza
        currentLevel.sequence.forEach(item => {
            const itemEl = document.createElement('div');
            itemEl.classList.add('sequence-item');
            itemEl.textContent = item;
            sequenceContainerEl.appendChild(itemEl);
        });
        // Aggiunge il placeholder per l'elemento mancante
        const placeholderEl = document.createElement('div');
        placeholderEl.classList.add('sequence-item', 'placeholder');
        placeholderEl.textContent = '?';
        sequenceContainerEl.appendChild(placeholderEl);

        // Mostra le opzioni
        const shuffledOptions = [...currentLevel.options].sort(() => Math.random() - 0.5);
        shuffledOptions.forEach(optionText => {
            const optionBtn = document.createElement('button');
            optionBtn.classList.add('option-btn');
            optionBtn.textContent = optionText;
            optionBtn.addEventListener('click', () => handleOptionClick(optionBtn, optionText, currentLevel.answer));
            optionsContainerEl.appendChild(optionBtn);
        });
    }

    // 4. Gestisce il click su un'opzione
    function handleOptionClick(clickedButton, chosenAnswer, correctAnswer) {
        optionsContainerEl.classList.add('disabled');

        if (chosenAnswer === correctAnswer) {
            clickedButton.classList.add('correct');
            feedbackTextEl.textContent = "Corretto!";
            feedbackTextEl.classList.add('correct');
            score++;
            scoreCountEl.textContent = score;
        } else {
            clickedButton.classList.add('incorrect');
            feedbackTextEl.textContent = `Sbagliato! La risposta era: ${correctAnswer}`;
            feedbackTextEl.classList.add('incorrect');
        }

        if (currentLevelIndex < gameData.length - 1) {
            nextBtn.classList.remove('hidden');
        } else {
            setTimeout(showGameEnd, 1500);
        }
    }

    // 5. Mostra la schermata di fine gioco
    function showGameEnd() {
        clearInterval(timerInterval);
        finalScoreEl.textContent = score;
        totalLevelsEl.textContent = gameData.length;
        finalTimeEl.textContent = timerEl.textContent;
        sendResultsToServer();
        modalEl.style.display = 'flex';
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

    // 7. Invia i risultati al server (funzione modificata)
    async function sendResultsToServer() {
        // Chiedi i dati allo studente
        const studentName = prompt("Complimenti! Inserisci il tuo nome per inviare i risultati all'insegnante:");
        const studentEmail = prompt("Ora inserisci la tua email:");

        if (!studentName || !studentEmail) {
            alert("Risultati non inviati. I campi sono obbligatori.");
            return;
        }

        const payload = {
            name: studentName,
            email: studentEmail,
            score: `${score} / ${gameData.length}`,
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

    // 8. Event listeners
    nextBtn.addEventListener('click', () => {
        currentLevelIndex++;
        loadLevel(currentLevelIndex);
    });
    playAgainBtn.addEventListener('click', initGame);
    speakBtn.addEventListener('click', () => speakText(instructionTextEl.textContent));

    // 9. Inizia il gioco
    initGame();
});