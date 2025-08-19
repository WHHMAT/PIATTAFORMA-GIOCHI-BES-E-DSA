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
    let studentInfo = {};

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
            questionTextEl.textContent = "Errore: impossibile caricare i dati del gioco.";
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
        questionTextEl.textContent = level.instruction;
        
        // Pulisce lo stato precedente
        itemsGridEl.innerHTML = '';
        itemsGridEl.classList.remove('disabled');
        feedbackTextEl.textContent = '';
        feedbackTextEl.className = '';
        nextBtn.classList.add('hidden');

        // Crea e aggiunge gli elementi del livello corrente
        level.items.forEach(itemData => {
            const itemEl = document.createElement('div');
            itemEl.classList.add('item');
            itemEl.textContent = itemData.content;
            
            itemEl.addEventListener('click', () => handleItemClick(itemEl, itemData.content === level.intruder));
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
            
            // Evidenzia anche la risposta corretta per aiutare l'apprendimento
            const allItemElements = Array.from(itemsGridEl.children);
            const correctIndex = gameData[currentLevelIndex].items.findIndex(item => item.content === gameData[currentLevelIndex].intruder);
            if (correctIndex !== -1) {
                allItemElements[correctIndex].classList.add('correct');
            }
        }

        // Mostra il pulsante per andare avanti, se non è l'ultimo livello
        if (currentLevelIndex < gameData.length - 1) {
            nextBtn.classList.remove('hidden');
        } else {
            setTimeout(showGameEnd, 2000); // Mostra la fine dopo un breve ritardo
        }
    }

    // 6. Mostra la schermata di fine gioco
    function showGameEnd() {
        clearInterval(timerInterval);

        // Popola il modale con i dati finali
        finalScoreEl.textContent = score;
        totalLevelsEl.textContent = gameData.length;
        finalTimeEl.textContent = timerEl.textContent;

        sendResultsToServer(); // Invia i risultati al server

        // Nasconde gli elementi del gioco e mostra il modale
        questionTextEl.textContent = "Gioco completato!";
        itemsGridEl.innerHTML = '';
        feedbackTextEl.textContent = '';
        nextBtn.classList.add('hidden');
        modalEl.style.display = 'flex';
    }

    // 7. Invia i risultati al server
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
            score: `${score} / ${gameData.length}`,
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
    loadGameData();
});