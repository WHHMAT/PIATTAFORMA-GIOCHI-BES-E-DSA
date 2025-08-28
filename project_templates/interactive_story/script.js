document.addEventListener('DOMContentLoaded', () => {
    // --- ELEMENTI DEL DOM ---
    const sceneTextEl = document.getElementById('scene-text');
    const choicesContainerEl = document.getElementById('choices-container');
    const timerEl = document.getElementById('timer');
    const modalEl = document.getElementById('end-game-modal');
    const finalResultEl = document.getElementById('final-result');
    const finalTimeEl = document.getElementById('final-time');
    const playAgainBtn = document.getElementById('play-again-btn');
    const speakBtn = document.getElementById('speak-btn');

    // 0. Qui caricheremo le variabili globali passate dal template
    //    `storyData` e `gameId` sono ora globali e disponibili grazie al template Python.
    //    Rimuovi il caricamento dei dati da URL
    // const urlParams = new URLSearchParams(window.location.search);
    // studentInfo = { name: urlParams.get('name'), email: urlParams.get('email') };

    // Qui definisci le variabili globali che verranno passate dal template
    let storyData = {};
    let gameId = "";
    
    // --- VARIABILI DI STATO ---
    let timerInterval = null;
    let seconds = 0;

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

    // 1. Inizializza o resetta la storia
    function initStory() {
        modalEl.style.display = 'none';
        choicesContainerEl.style.display = 'flex';
        startTimer();
        showScene(storyData.start_node || 'start');
    }
    
    // 2. Mostra una scena
    function showScene(sceneId) {
        const scene = storyData.nodes[sceneId];
        sceneTextEl.textContent = scene.text;
        choicesContainerEl.innerHTML = '';

        if (scene.choices && scene.choices.length > 0) {
            scene.choices.forEach(choice => {
                const button = document.createElement('button');
                button.classList.add('choice-btn');
                button.textContent = choice.text;
                button.addEventListener('click', () => showScene(choice.leads_to));
                choicesContainerEl.appendChild(button);
            });
        } else {
            showStoryEnd(scene.text);
        }
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

    // 4. Mostra la schermata di fine storia e invia i risultati
    function showStoryEnd(endingText) {
        clearInterval(timerInterval);
        finalResultEl.textContent = endingText;
        finalTimeEl.textContent = timerEl.textContent;

        sendResultsToServer(endingText);

        choicesContainerEl.style.display = 'none';
        modalEl.style.display = 'flex';
    }

    // 5. Invia i risultati al server (funzione modificata)
    async function sendResultsToServer(endingText) {
        const studentName = prompt("Complimenti! Inserisci il tuo nome per inviare i risultati all'insegnante:");
        const studentEmail = prompt("Ora inserisci la tua email:");

        if (!studentName || !studentEmail) {
            alert("Risultati non inviati. I campi sono obbligatori.");
            return;
        }

        const payload = {
            name: studentName,
            email: studentEmail,
            score: `Finale: "${endingText}"`,
            time: timerEl.textContent,
        };

        try {
            // Usa la variabile globale `gameId` per inviare i dati all'API corretta
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

    // 6. Event listeners e avvio
    playAgainBtn.addEventListener('click', initStory);
    speakBtn.addEventListener('click', () => {
        const textToSpeak = sceneTextEl.textContent;
        if (textToSpeak) speakText(textToSpeak);
    });

    // Invece di chiamare loadStoryData, usiamo le variabili globali passate dal template
    if (typeof gameData !== 'undefined') {
        storyData = gameData;
        initStory();
    } else {
        sceneTextEl.textContent = "Errore: dati del gioco non disponibili.";
    }
});