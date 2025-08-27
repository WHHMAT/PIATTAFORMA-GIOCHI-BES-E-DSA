document.addEventListener('DOMContentLoaded', () => {
    // --- DATI DEL GIOCO ---
    // Modifica questo array per cambiare le domande e le risposte del quiz.
    const gameData = [
        {
            question: "Qual è la capitale d'Italia?",
            options: ["Parigi", "Roma", "Berlino", "Madrid"],
            answer: "Roma"
        },
        {
            question: "Quanto fa 2 + 2?",
            options: ["3", "4", "5", "6"],
            answer: "4"
        },
        {
            question: "Quale pianeta è conosciuto come il 'Pianeta Rosso'?",
            options: ["Venere", "Marte", "Giove", "Saturno"],
            answer: "Marte"
        }
    ];

    // --- ELEMENTI DEL DOM ---
    const questionTitleEl = document.getElementById('question-title');
    const optionsContainerEl = document.getElementById('options-container');
    const feedbackTextEl = document.getElementById('feedback-text');
    const nextBtn = document.getElementById('next-btn');
    const scoreCountEl = document.getElementById('score-count');
    const timerEl = document.getElementById('timer');
    const modalEl = document.getElementById('end-game-modal');
    const finalScoreEl = document.getElementById('final-score');
    const totalQuestionsEl = document.getElementById('total-questions');
    const finalTimeEl = document.getElementById('final-time');
    const playAgainBtn = document.getElementById('play-again-btn');
    const speakBtn = document.getElementById('speak-btn'); // Pulsante per la sintesi vocale

    // --- VARIABILI DI STATO ---
    let currentQuestionIndex = 0;
    let score = 0;
    let timerInterval = null;
    let seconds = 0;
    let studentInfo = {};

    // 0. Recupera i dati dello studente dall'URL
    const urlParams = new URLSearchParams(window.location.search);
    studentInfo = { name: urlParams.get('name'), email: urlParams.get('email') };

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

    // 1. Inizializza o resetta il gioco
    function initGame() {
        currentQuestionIndex = 0;
        score = 0;
        scoreCountEl.textContent = score;
        modalEl.style.display = 'none';
        
        // Rendi visibili gli elementi del gioco
        questionTitleEl.style.display = 'block';
        optionsContainerEl.style.display = 'grid';
        
        startTimer();
        loadQuestion(currentQuestionIndex);
    }

    // 2. Carica una domanda specifica
    function loadQuestion(questionIndex) {
        // Pulisce lo stato precedente
        optionsContainerEl.innerHTML = '';
        optionsContainerEl.classList.remove('disabled');
        feedbackTextEl.textContent = '';
        feedbackTextEl.className = '';
        nextBtn.classList.add('hidden');

        const currentQuestion = gameData[questionIndex];
        questionTitleEl.textContent = currentQuestion.question;

        // Mescola le opzioni per renderle casuali ogni volta
        const shuffledOptions = [...currentQuestion.options].sort(() => Math.random() - 0.5);

        shuffledOptions.forEach(optionText => {
            const optionBtn = document.createElement('button');
            optionBtn.classList.add('option-btn');
            optionBtn.textContent = optionText;
            optionBtn.addEventListener('click', () => handleOptionClick(optionBtn, optionText, currentQuestion.answer));
            optionsContainerEl.appendChild(optionBtn);
        });
    }

    // 3. Avvia e gestisce il timer
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

    // 4. Gestisce il click su un'opzione
    function handleOptionClick(clickedButton, chosenAnswer, correctAnswer) {
        optionsContainerEl.classList.add('disabled'); // Disabilita ulteriori click

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
            
            // Evidenzia anche la risposta corretta
            const allButtons = Array.from(optionsContainerEl.children);
            const correctButton = allButtons.find(btn => btn.textContent === correctAnswer);
            if (correctButton) {
                correctButton.classList.add('correct');
            }
        }

        // Mostra il pulsante per andare avanti
        if (currentQuestionIndex < gameData.length - 1) {
            nextBtn.classList.remove('hidden');
        } else {
            setTimeout(showGameEnd, 1500); // Mostra la fine dopo un breve ritardo
        }
    }

    // 5. Mostra la schermata di fine gioco
    function showGameEnd() {
        clearInterval(timerInterval);

        finalScoreEl.textContent = score;
        totalQuestionsEl.textContent = gameData.length;
        finalTimeEl.textContent = timerEl.textContent;

        sendResultsToServer(); // Invia i risultati al server

        questionTitleEl.style.display = 'none';
        optionsContainerEl.style.display = 'none';
        feedbackTextEl.textContent = '';
        nextBtn.classList.add('hidden');
        modalEl.style.display = 'flex';
    }

    // 6. Invia i risultati al server
    async function sendResultsToServer() {
        // Invia solo se nome e email sono presenti
        if (!studentInfo.name || !studentInfo.email) {
            console.log("Dati studente non trovati, invio email saltato.");
            return;
        }

        const projectName = window.location.pathname.split('/')[2];
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

    // 7. Event listeners
    nextBtn.addEventListener('click', () => {
        currentQuestionIndex++;
        loadQuestion(currentQuestionIndex);
    });
    playAgainBtn.addEventListener('click', initGame);
    // Aggiunge l'evento al pulsante per leggere la domanda
    speakBtn.addEventListener('click', () => {
        const textToSpeak = questionTitleEl.textContent;
        if (textToSpeak) speakText(textToSpeak);
    });

    // 8. Inizia il gioco
    initGame();
});
