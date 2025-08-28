document.addEventListener('DOMContentLoaded', () => {
    // --- ELEMENTI DEL DOM ---
    const sceneTextEl = document.getElementById('scene-text');
    const choicesContainerEl = document.getElementById('choices-container');
    const timerEl = document.getElementById('timer');
    // Elementi del modale di fine gioco
    const modalEl = document.getElementById('end-game-modal');
    const finalResultEl = document.getElementById('final-result');
    const finalTimeEl = document.getElementById('final-time');
    const playAgainBtn = document.getElementById('play-again-btn');
    const speakBtn = document.getElementById('speak-btn');
    // Elementi del form nel modale
    const resultForm = document.getElementById('result-form');
    const studentNameInput = document.getElementById('student-name');
    const studentEmailInput = document.getElementById('student-email');
    const formFeedback = document.getElementById('form-feedback');

    // Le variabili globali `gameData` e `gameId` vengono iniettate dal template
    // e non hanno bisogno di essere definite qui.
    
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
        showScene(gameData.start_node || 'start');
    }
    
    // 2. Mostra una scena
    function showScene(sceneId) {
        const scene = gameData.nodes[sceneId];
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
        
        // Resetta lo stato del form per una nuova partita
        if (resultForm) {
            resultForm.style.display = 'block';
            resultForm.reset();
            resultForm.querySelector('button').disabled = false;
        }
        if (formFeedback) formFeedback.style.display = 'none';
        
        choicesContainerEl.style.display = 'none';
        modalEl.style.display = 'flex';
    }

    // 5. Invia i risultati al server (funzione modificata)
    async function sendResultsToServer() {
        const studentName = studentNameInput.value.trim();
        const studentEmail = studentEmailInput.value.trim();
        
        if (!studentName || !studentEmail) {
            alert("Nome e email sono obbligatori.");
            return;
        }

        const payload = {
            name: studentName,
            email: studentEmail,
            score: `Finale: "${finalResultEl.textContent}"`, // Prende il risultato dal modale
            time: timerEl.textContent,
        };

        const submitBtn = resultForm.querySelector('button');
        submitBtn.disabled = true;
        formFeedback.style.display = 'block';
        formFeedback.textContent = 'Invio in corso...';

        try {
            // Usa la variabile globale `gameId` per inviare i dati all'API corretta
            const response = await fetch(`/api/submit_result/${gameId}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            
            const result = await response.json();
            if (!response.ok) throw new Error(result.message || 'Errore di rete.');

            if (result.status === 'success') {
                formFeedback.textContent = "Risultati inviati con successo!";
                resultForm.style.display = 'none'; // Nasconde il form dopo l'invio
            } else {
                throw new Error(result.message || 'Errore sconosciuto.');
            }

        } catch (error) {
            console.error("Errore nell'invio dei risultati:", error);
            formFeedback.textContent = `Errore: ${error.message}. Riprova.`;
            submitBtn.disabled = false; // Riabilita il pulsante in caso di errore
        }
    }

    // 6. Event listeners e avvio
    playAgainBtn.addEventListener('click', () => {
        modalEl.style.display = 'none';
        initStory();
    });
    speakBtn.addEventListener('click', () => {
        const textToSpeak = sceneTextEl.textContent;
        if (textToSpeak) speakText(textToSpeak);
    });

    // Aggiungi listener per il submit del form
    if (resultForm) {
        resultForm.addEventListener('submit', (e) => {
            e.preventDefault(); // Impedisce il ricaricamento della pagina
            sendResultsToServer();
        });
    }

    // Invece di chiamare loadStoryData, usiamo le variabili globali passate dal template
    if (typeof gameData !== 'undefined' && gameData.nodes && typeof gameId !== 'undefined') {
        initStory();
    } else {
        sceneTextEl.textContent = "Errore: dati del gioco non disponibili.";
        console.error("Errore: 'gameData' o 'gameId' non sono definiti correttamente.");
    }
});