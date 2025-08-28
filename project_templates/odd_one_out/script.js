document.addEventListener('DOMContentLoaded', () => {
    const questionTextEl = document.getElementById('question-text');
    const itemsGridEl = document.getElementById('items-grid');
    const feedbackTextEl = document.getElementById('feedback-text');
    const nextBtn = document.getElementById('next-btn');
    const scoreCountEl = document.getElementById('score-count');
    const timerEl = document.getElementById('timer');
    const modalEl = document.getElementById('end-game-modal');
    const finalScoreEl = document.getElementById('final-score');
    const totalLevelsEl = document.getElementById('total-levels');
    const finalTimeEl = document.getElementById('final-time');
    const playAgainBtn = document.getElementById('play-again-btn');
    const speakBtn = document.getElementById('speak-btn');

    let gameData = [];
    let currentLevelIndex = 0;
    let score = 0;
    let timerInterval = null;
    let seconds = 0;

    // 0. Le variabili `gameData` e `gameId` sono ora globali e disponibili.
    //    Rimuovi il recupero dei dati dello studente dall'URL.
    //    const urlParams = new URLSearchParams(window.location.search);
    //    studentInfo = { name: urlParams.get('name'), email: urlParams.get('email') };

    // 1. Rimuovi la funzione loadGameData()
    //    Il gioco userà direttamente la variabile `gameData` passata dal server.
    //    async function loadGameData() { ... }

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

    // 2. Inizializza o resetta il gioco
    function initGame() {
        currentLevelIndex = 0;
        score = 0;
        scoreCountEl.textContent = score;
        modalEl.style.display = 'none';
        startTimer();
        loadLevel(currentLevelIndex);
    }

    // 3. Carica un livello specifico
    function loadLevel(levelIndex) {
        if (levelIndex >= gameData.length) {
            showGameEnd();
            return;
        }

        const level = gameData[levelIndex];
        questionTextEl.textContent = level.question;
        
        itemsGridEl.innerHTML = '';
        itemsGridEl.classList.remove('disabled');
        feedbackTextEl.textContent = '';
        feedbackTextEl.className = '';
        nextBtn.classList.add('hidden');

        level.items.forEach(itemData => {
            const itemEl = document.createElement('div');
            itemEl.classList.add('item');
            
            // Aggiungi immagine o testo a seconda della presenza di `image`
            if (itemData.image) {
                const img = document.createElement('img');
                img.src = itemData.image;
                img.alt = itemData.text;
                itemEl.appendChild(img);
                if (itemData.text) {
                    const span = document.createElement('span');
                    span.textContent = itemData.text;
                    itemEl.appendChild(span);
                }
            } else {
                itemEl.textContent = itemData.text;
            }
            
            itemEl.addEventListener('click', () => handleItemClick(itemEl, itemData.is_intruder));
            itemsGridEl.appendChild(itemEl);
        });
    }

    // 4. Avvia e gestisce il timer
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

    // 5. Gestisce il click su un elemento
    function handleItemClick(element, isIntruder) {
        itemsGridEl.classList.add('disabled'); // Disabilita ulteriori click

        if (isIntruder) {
            element.classList.add('correct');
            feedbackTextEl.textContent = "Corretto!";
            feedbackTextEl.classList.add('correct');
            score++;
            scoreCountEl.textContent = score;
        } else {
            element.classList.add('incorrect');
            feedbackTextEl.textContent = "Sbagliato!";
            feedbackTextEl.classList.add('incorrect');
            
            const allItemElements = Array.from(itemsGridEl.children);
            const correctIndex = gameData[currentLevelIndex].items.findIndex(item => item.is_intruder === true);
            if (correctIndex !== -1) {
                allItemElements[correctIndex].classList.add('correct');
            }
        }

        if (currentLevelIndex < gameData.length - 1) {
            nextBtn.classList.remove('hidden');
        } else {
            setTimeout(showGameEnd, 2000);
        }
    }

    // 6. Mostra la schermata di fine gioco
    function showGameEnd() {
        clearInterval(timerInterval);

        finalScoreEl.textContent = score;
        totalLevelsEl.textContent = gameData.length;
        finalTimeEl.textContent = timerEl.textContent;

        sendResultsToServer();

        questionTextEl.textContent = "Gioco completato!";
        itemsGridEl.innerHTML = '';
        feedbackTextEl.textContent = '';
        nextBtn.classList.add('hidden');
        modalEl.style.display = 'flex';
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
    speakBtn.addEventListener('click', () => {
        const textToSpeak = questionTextEl.textContent;
        if (textToSpeak) speakText(textToSpeak);
    });

    // 9. Inizia il gioco
    // Usa la variabile globale `gameData` per inizializzare il gioco
    if (typeof gameData !== 'undefined' && gameData.length > 0) {
        initGame();
    } else {
        questionTextEl.textContent = "Errore: impossibile caricare i dati del gioco.";
    }
});