document.addEventListener('DOMContentLoaded', () => {
    const sceneTextEl = document.getElementById('scene-text');
    const choicesContainerEl = document.getElementById('choices-container');
    const timerEl = document.getElementById('timer');
    const modalEl = document.getElementById('end-game-modal');
    const finalResultEl = document.getElementById('final-result');
    const finalTimeEl = document.getElementById('final-time');
    const playAgainBtn = document.getElementById('play-again-btn');
    const speakBtn = document.getElementById('speak-btn');

    let storyData = {};
    let timerInterval = null;
    let seconds = 0;
    let studentInfo = {};

    // 0. Recupera i dati dello studente dall'URL
    const urlParams = new URLSearchParams(window.location.search);
    studentInfo = { name: urlParams.get('name'), email: urlParams.get('email') };

    // 1. Carica i dati della storia
    async function loadStoryData() {
        try {
            const response = await fetch('data.json');
            if (!response.ok) throw new Error(`Errore HTTP: ${response.status}`);
            storyData = await response.json();
            initStory();
        } catch (error) {
            console.error("Errore nel caricamento di data.json:", error);
            sceneTextEl.textContent = "Errore: impossibile caricare i dati della storia.";
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

    // 2. Inizializza o resetta la storia
    function initStory() {
        modalEl.style.display = 'none';
        choicesContainerEl.style.display = 'flex';
        startTimer();
        showScene(storyData.start_node || 'start');
    }

    // 3. Mostra una scena
    function showScene(sceneId) {
        const scene = storyData.nodes[sceneId];
        sceneTextEl.textContent = scene.text;
        choicesContainerEl.innerHTML = '';

        if (scene.choices && scene.choices.length > 0) {
            // È una scena con scelte
            scene.choices.forEach(choice => {
                const button = document.createElement('button');
                button.classList.add('choice-btn');
                button.textContent = choice.text;
                button.addEventListener('click', () => showScene(choice.leads_to));
                choicesContainerEl.appendChild(button);
            });
        } else {
            // È un finale
            showStoryEnd(scene.text);
        }
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

    // 5. Mostra la schermata di fine storia e invia i risultati
    function showStoryEnd(endingText) {
        clearInterval(timerInterval);
        finalResultEl.textContent = endingText;
        finalTimeEl.textContent = timerEl.textContent;

        sendResultsToServer(endingText);

        choicesContainerEl.style.display = 'none';
        modalEl.style.display = 'flex';
    }

    // 6. Invia i risultati al server
    async function sendResultsToServer(endingText) {
        if (!studentInfo.name || !studentInfo.email) {
            console.log("Dati studente non trovati, invio email saltato.");
            return;
        }

        const pathParts = window.location.pathname.split('/');
        const projectName = pathParts[pathParts.length - 2];
        const payload = {
            ...studentInfo,
            score: `Finale: "${endingText}"`, // Il "punteggio" è il testo del finale
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

    // 7. Event listeners e avvio
    playAgainBtn.addEventListener('click', initStory);
    speakBtn.addEventListener('click', () => {
        const textToSpeak = sceneTextEl.textContent;
        if (textToSpeak) speakText(textToSpeak);
    });
    loadStoryData();
});