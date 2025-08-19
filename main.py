# main.py

from flask import Flask, render_template, request, redirect, url_for, flash, send_file, send_from_directory, jsonify
from flask_sqlalchemy import SQLAlchemy
import re, json, os
import os, shutil, io, zipfile
from datetime import datetime
import mailchimp_transactional
from mailchimp_transactional.api_client import ApiClientError

app = Flask(__name__)

# --- CONFIGURAZIONE DATABASE ---
# Usa un percorso assoluto per il file del database per evitare ambiguità
db_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'database.db')
app.config['SQLALCHEMY_DATABASE_URI'] = f'sqlite:///{db_path}'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
db = SQLAlchemy(app)

app.config['UPLOAD_FOLDER'] = 'projects' # Where game projects will be stored
app.config['TEMPLATES_FOLDER'] = 'project_templates'
RESULTS_PER_PAGE = 15 # Numero di risultati da mostrare per pagina

# --- DIAGNOSTICA PER DEBUG ---
print("--- CONTROLLO CONFIGURAZIONE EMAIL ---")
print(f"MAILCHIMP_API_KEY impostata: {'Sì' if os.environ.get('MAILCHIMP_API_KEY') else 'NO'}")
print("------------------------------------")

# --- CONFIGURAZIONE EMAIL ---
# Carica la chiave API e l'email del mittente dalle variabili d'ambiente per sicurezza e flessibilità.
# NON inserire mai chiavi segrete direttamente nel codice.
mailchimp_api_key = os.environ.get('MAILCHIMP_API_KEY') 
SENDER_EMAIL_VERIFIED = os.environ.get('SENDER_EMAIL_VERIFIED')

# Inizializza il client di Mailchimp Transactional
mailchimp_client = mailchimp_transactional.Client(mailchimp_api_key) if mailchimp_api_key else None

# In una vera applicazione, questa chiave dovrebbe essere una stringa lunga, casuale e segreta.
app.secret_key = 'dev-secret-key'

# Assicura che la cartella principale dei progetti esista all'avvio
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)

# --- MODELLO DATABASE ---
# Definiamo la struttura della tabella che conterrà i risultati dei giochi.
class GameResult(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    student_name = db.Column(db.String(100), nullable=False)
    student_email = db.Column(db.String(100), nullable=False)
    project_name = db.Column(db.String(100), nullable=False)
    score = db.Column(db.String(50), nullable=False)
    time_spent = db.Column(db.String(50), nullable=False)
    timestamp = db.Column(db.DateTime, default=datetime.utcnow)

    def __repr__(self):
        return f'<GameResult {self.student_name} - {self.project_name}>'



# --- Game Development Platform Core ---


@app.route('/')
def index():
    """Renders the main landing page."""
    # Per ora, reindirizziamo direttamente alla dashboard
    return redirect(url_for('dashboard'))

@app.route('/dashboard')
def dashboard():
    """Renders the user dashboard, showing their projects."""
    projects_dir = app.config['UPLOAD_FOLDER']
    user_projects = []
    try:
        # In una vera app, qui si recupererebbero i progetti associati all'utente loggato
        project_folders = [d for d in os.listdir(projects_dir) if os.path.isdir(os.path.join(projects_dir, d))]
        for p_folder in project_folders:
            manifest_path = os.path.join(projects_dir, p_folder, 'manifest.json')
            display_name = p_folder # Nome di fallback
            if os.path.isfile(manifest_path):
                try:
                    with open(manifest_path, 'r', encoding='utf-8') as f:
                        manifest = json.load(f)
                        display_name = manifest.get('name', p_folder)
                except (json.JSONDecodeError, IOError):
                    # Se il manifest è corrotto o illeggibile, usa il nome della cartella
                    pass
            user_projects.append({'id': p_folder, 'name': display_name})
    except FileNotFoundError:
        pass # user_projects rimane una lista vuota
    return render_template('dashboard.html', projects=user_projects)

@app.route('/reports')
def reports():
    """Mostra una pagina con tutti i risultati dei giochi salvati, con filtri e paginazione."""
    try:
        # Recupera il numero di pagina e i filtri dalla richiesta GET
        page = request.args.get('page', 1, type=int)
        selected_student = request.args.get('student_name', '')
        selected_project = request.args.get('project_name', '')
        selected_email = request.args.get('student_email', '')

        # Inizia la query di base
        query = GameResult.query

        # Applica i filtri alla query
        if selected_student:
            query = query.filter(GameResult.student_name == selected_student)
        if selected_project:
            query = query.filter(GameResult.project_name == selected_project)
        if selected_email:
            query = query.filter(GameResult.student_email == selected_email)

        # Usa .paginate() invece di .all() per ottenere solo i risultati della pagina corrente
        pagination = query.order_by(GameResult.timestamp.desc()).paginate(
            page=page, per_page=RESULTS_PER_PAGE, error_out=False
        )

        # Recupera le opzioni uniche per i menu a tendina dei filtri
        students = [r[0] for r in db.session.query(GameResult.student_name).distinct().order_by(GameResult.student_name).all()]
        projects = [r[0] for r in db.session.query(GameResult.project_name).distinct().order_by(GameResult.project_name).all()]
        emails = [r[0] for r in db.session.query(GameResult.student_email).distinct().order_by(GameResult.student_email).all()]

    except Exception as e:
        print(f"Errore nel recuperare i report: {e}")
        flash("Impossibile caricare i report. Controllare la connessione al database.", "error")
        pagination = None
        students, projects, emails = [], [], []
    
    return render_template('reports.html', pagination=pagination,
                           students=students, projects=projects, emails=emails,
                           selected_student=request.args.get('student_name', ''),
                           selected_project=request.args.get('project_name', ''),
                           selected_email=request.args.get('student_email', ''))

def get_available_templates():
    """Scansiona la cartella dei template e restituisce una lista di template disponibili."""
    templates = []
    templates_dir = app.config['TEMPLATES_FOLDER']
    if not os.path.isdir(templates_dir):
        return []
    for t_name in os.listdir(templates_dir):
        manifest_path = os.path.join(templates_dir, t_name, 'manifest.json')
        if os.path.isfile(manifest_path):
            with open(manifest_path, 'r') as f:
                try:
                    manifest = json.load(f)
                    templates.append({
                        'id': t_name,
                        'name': manifest.get('name', t_name),
                        'description': manifest.get('description', 'Nessuna descrizione.')
                    })
                except json.JSONDecodeError:
                    continue # Salta i manifest corrotti
    return templates

@app.route('/create_project', methods=['GET', 'POST'])
def create_project():
    """Allows users to create a new game project."""
    if request.method == 'POST':
        project_name = request.form.get('project_name', '').strip()
        template_type = request.form.get('template_type')

        if not project_name or not template_type:
            return jsonify({'status': 'error', 'message': 'Il nome del progetto e il template non possono essere vuoti.'}), 400

        # Rende il nome del progetto sicuro per essere usato come nome di una cartella
        safe_project_name = re.sub(r'[^\w\s-]', '', project_name).strip().replace(' ', '_')
        project_path = os.path.join(app.config['UPLOAD_FOLDER'], safe_project_name)
        template_path = os.path.join(app.config['TEMPLATES_FOLDER'], template_type)

        if os.path.exists(project_path):
            return jsonify({'status': 'error', 'message': f'Un progetto di nome "{safe_project_name}" esiste già.'}), 409
        
        if not os.path.isdir(template_path):
            return jsonify({'status': 'error', 'message': 'Il template selezionato non è valido.'}), 400

        # Copia i file del template nella nuova cartella del progetto
        shutil.copytree(template_path, project_path)

        # Ora, aggiorniamo il manifest del nuovo progetto con il nome scelto dall'utente.
        new_manifest_path = os.path.join(project_path, 'manifest.json')
        if os.path.isfile(new_manifest_path):
            try:
                with open(new_manifest_path, 'r+', encoding='utf-8') as f:
                    manifest_data = json.load(f)
                    manifest_data['name'] = project_name # Usiamo il nome originale fornito dall'utente
                    manifest_data['template_id'] = template_type # Aggiungiamo l'ID del template
                    f.seek(0)  # Torniamo all'inizio del file per sovrascriverlo
                    json.dump(manifest_data, f, indent=4, ensure_ascii=False)
                    f.truncate() # Rimuove il contenuto rimanente se il nuovo JSON è più corto
            except (IOError, json.JSONDecodeError) as e:
                print(f"Attenzione: non è stato possibile aggiornare il manifest per {safe_project_name}. Errore: {e}")

        return jsonify({'status': 'success', 'message': f'Progetto "{project_name}" creato con successo!', 'redirect_url': url_for('dashboard')})

    # Per le richieste GET, mostra il modulo di creazione
    available_templates = get_available_templates()
    return render_template('create_project.html', templates=available_templates)

@app.route('/launch/<string:project_name>')
def launch_game(project_name):
    """Mostra una pagina di avvio per inserire i dati dello studente."""
    project_path = os.path.join(app.config['UPLOAD_FOLDER'], project_name)
    if not os.path.isdir(project_path):
        flash(f'Progetto "{project_name}" non trovato.', 'error')
        return redirect(url_for('dashboard'))
    return render_template('launch_game.html', project_name=project_name)

@app.route('/play/<string:project_name>')
def play_game(project_name):
    """Reindirizza al file index.html del gioco, mantenendo i parametri URL."""
    target_url = url_for('serve_project_file', project_name=project_name, filename='index.html')
    
    query_string = request.query_string.decode('utf-8')
    if query_string:
        # Reindirizza aggiungendo i parametri all'URL di destinazione
        return redirect(f"{target_url}?{query_string}")
    return redirect(target_url)

@app.route('/preview/<string:project_name>')
def preview_project_redirect(project_name):
    """Redirects to the project's index.html to establish the correct base path."""
    # Questo assicura che i percorsi relativi per CSS/JS all'interno dell'HTML funzionino correttamente.
    return redirect(url_for('serve_project_file', project_name=project_name, filename='index.html'))

@app.route('/preview/<string:project_name>/<path:filename>')
def serve_project_file(project_name, filename):
    """Serves a file from a specific project's directory for the live preview."""
    project_dir = os.path.join(app.config['UPLOAD_FOLDER'], project_name)
    # Controllo di sicurezza di base
    if not os.path.isdir(project_dir):
        flash(f'Progetto "{project_name}" non trovato.', 'error')
        return redirect(url_for('dashboard'))
    return send_from_directory(project_dir, filename)

@app.route('/edit_project/<string:project_name>')
def edit_project(project_name):
    """Rende la pagina dell'editor di codice per un progetto specifico."""
    project_path = os.path.join(app.config['UPLOAD_FOLDER'], project_name)
    if not os.path.isdir(project_path):
        flash(f'Progetto "{project_name}" non trovato.', 'error')
        return redirect(url_for('dashboard'))

    # Elenca i file modificabili nella directory del progetto
    allowed_extensions = ('.html', '.css', '.js', '.json')
    files = [f for f in os.listdir(project_path) if os.path.isfile(os.path.join(project_path, f)) and f.endswith(allowed_extensions)]
    
    return render_template('edit_project.html', project_name=project_name, files=files)

@app.route('/visual_edit/<string:project_name>')
def visual_edit_project(project_name):
    """Mostra un editor visuale specifico per il tipo di gioco."""
    project_path = os.path.join(app.config['UPLOAD_FOLDER'], project_name)
    manifest_path = os.path.join(project_path, 'manifest.json')

    if not os.path.isfile(manifest_path):
        flash('Editor visuale non disponibile: manifest.json non trovato.', 'error')
        return redirect(url_for('edit_project', project_name=project_name))

    try:
        with open(manifest_path, 'r', encoding='utf-8') as f:
            manifest = json.load(f)
        template_id = manifest.get('template_id')

        if not template_id:
            flash('Editor visuale non disponibile: tipo di template non specificato.', 'error')
            return redirect(url_for('edit_project', project_name=project_name))

        # Carica i dati correnti da data.json per passarli al template
        data_path = os.path.join(project_path, 'data.json')
        game_data = []
        if os.path.isfile(data_path):
            with open(data_path, 'r', encoding='utf-8') as f:
                game_data = json.load(f)

        # Mappa l'ID del template al suo template di editor visuale
        editor_template_map = {
            'matching_game': 'visual_editor_matching.html',
            'logic_maze': 'visual_editor_logic_maze.html',
            'drag_and_drop': 'visual_editor_drag_and_drop.html',
            'sequence_completion': 'visual_editor_sequence_completion.html',
            'interactive_story': 'visual_editor_interactive_story.html',
            'memory_game': 'visual_editor_memory_game.html',
            'odd_one_out': 'visual_editor_odd_one_out.html',
            'quiz': 'visual_editor_quiz_game.html'
        }
        editor_template = editor_template_map.get(template_id)

        if not editor_template:
            flash(f'Nessun editor visuale disponibile per il tipo di gioco "{template_id}".', 'warning')
            return redirect(url_for('edit_project', project_name=project_name))

        return render_template(editor_template, project_name=project_name, game_data=game_data)
    except (IOError, json.JSONDecodeError) as e:
        flash(f'Errore nel caricamento dei dati del progetto: {e}', 'error')
        return redirect(url_for('dashboard'))

@app.route('/api/project/<string:project_name>/file/<path:filename>', methods=['GET'])
def get_file_content(project_name, filename):
    """API per ottenere il contenuto di un file."""
    project_path = os.path.join(app.config['UPLOAD_FOLDER'], project_name)
    file_path = os.path.join(project_path, filename)

    # Controllo di sicurezza per impedire l'accesso a file fuori dalla cartella del progetto
    if not os.path.abspath(file_path).startswith(os.path.abspath(project_path)):
        return jsonify({'error': 'Accesso non autorizzato'}), 403

    if not os.path.isfile(file_path):
        return jsonify({'error': 'File non trovato'}), 404

    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    return jsonify({'content': content})

@app.route('/api/project/<string:project_name>/file/<path:filename>', methods=['POST'])
def save_file_content(project_name, filename):
    """API per salvare il contenuto di un file."""
    project_path = os.path.join(app.config['UPLOAD_FOLDER'], project_name)
    file_path = os.path.join(project_path, filename)

    if not os.path.abspath(file_path).startswith(os.path.abspath(project_path)):
        return jsonify({'error': 'Accesso non autorizzato'}), 403

    data = request.get_json()
    if 'content' not in data:
        return jsonify({'error': 'Contenuto mancante'}), 400

    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(data['content'])
    return jsonify({'status': 'success', 'message': f'File "{filename}" salvato con successo.'})

@app.route('/api/project/<string:project_name>/visual_data', methods=['POST'])
def save_visual_data(project_name):
    """API per salvare i dati da un editor visuale (es. data.json)."""
    project_path = os.path.join(app.config['UPLOAD_FOLDER'], project_name)
    file_path = os.path.join(project_path, 'data.json')

    # Controllo di sicurezza
    if not os.path.abspath(file_path).startswith(os.path.abspath(project_path)):
        return jsonify({'error': 'Accesso non autorizzato'}), 403

    if not os.path.isdir(project_path):
        return jsonify({'error': 'Progetto non trovato'}), 404

    data = request.get_json()
    if data is None:
        return jsonify({'error': 'Dati mancanti o non in formato JSON valido'}), 400

    try:
        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=4, ensure_ascii=False)
        return jsonify({'status': 'success', 'message': 'Dati del gioco salvati con successo.'})
    except IOError as e:
        return jsonify({'error': f'Errore di scrittura del file: {e}'}), 500

@app.route('/api/submit_result/<string:project_name>', methods=['POST'])
def submit_result(project_name):
    """API per ricevere i risultati del gioco e inviare un'email."""
    data = request.get_json()
    if not mailchimp_client:
        print("ERRORE: Chiave API di Mailchimp non configurata.")
        return jsonify({'error': 'Il servizio email non è configurato correttamente.'}), 500

    if not data or not all(k in data for k in ['name', 'email', 'score', 'time']):
        return jsonify({'error': 'Dati mancanti'}), 400

    # --- Pulizia Dati Robusta ---
    # Pulisce tutti i dati di testo da eventuali caratteri problematici come lo spazio indivisibile (\xa0)
    # per prevenire errori di encoding.
    student_name = data.get('name', '').replace('\xa0', ' ').strip()
    clean_project_name = project_name.replace('\xa0', ' ').strip()
    recipient_email = data.get('email').strip()
    
    # Usa l'email del mittente configurata tramite variabili d'ambiente.
    # Questa DEVE essere un'email appartenente a un dominio che hai verificato su Mailchimp.
    if not SENDER_EMAIL_VERIFIED:
        print("ERRORE: L'email del mittente (MAILCHIMP_SENDER_EMAIL) non è configurata.")
        return jsonify({'error': 'Il servizio email non è configurato correttamente dal lato server.'}), 500

    # --- SALVATAGGIO SU DATABASE ---
    try:
        new_result = GameResult(
            student_name=student_name,
            student_email=recipient_email,
            project_name=clean_project_name,
            score=data.get('score', 'N/D'),
            time_spent=data.get('time', 'N/D')
        )
        db.session.add(new_result)
        db.session.commit()
        print(f"Risultato salvato nel database per {student_name}.")
    except Exception as e:
        db.session.rollback()
        print(f"ERRORE nel salvataggio su database: {e}")
        # Non blocchiamo l'invio dell'email se il DB fallisce, ma logghiamo l'errore.

    # Aggiorna il dizionario 'data' con il nome pulito per passarlo al template
    data['name'] = student_name

    try:
        # 1. Renderizza il corpo HTML dell'email usando il template esistente
        html_body = render_template('email_result.html', **data, project_name=clean_project_name)

        # 2. Costruisci l'oggetto messaggio per l'API di Mailchimp
        message = {
            "html": html_body,
            "subject": f"Risultati del gioco '{clean_project_name}' per {student_name}",
            "from_email": SENDER_EMAIL_VERIFIED,
            "from_name": "Piattaforma Giochi BES/DSA",
            "to": [{"email": recipient_email, "type": "to"}]
        }

        # 3. Invia l'email tramite l'API
        response = mailchimp_client.messages.send({"message": message})
        print(f"Risposta da Mailchimp: {response}")  # Per debug
        return jsonify({'status': 'success', 'message': 'Email inviata con successo.'})
    except ApiClientError as e:
        # Gestisce specificamente gli errori dell'API di Mailchimp
        print(f"Errore API Mailchimp: {e.text}")  # Per il debug
        return jsonify({'error': 'Impossibile inviare l\'email. Errore API.'}), 500
    except Exception as e:
        # Gestisce altri errori, come problemi di rete (es. Timeout)
        # La libreria mailchimp-transactional usa 'requests' internamente, che può lanciare
        # eccezioni come requests.exceptions.ConnectTimeout.
        print(f"Errore di rete o generico durante l'invio dell'email: {e}")
        return jsonify({'error': 'Impossibile connettersi al servizio email. Controllare la connessione internet del server e le impostazioni del firewall.'}), 503

@app.route('/delete_project/<string:project_name>', methods=['POST'])
def delete_project(project_name):
    """Elimina la cartella di un progetto."""
    # Per sicurezza, puliamo il nome del progetto anche se proviene dal nostro sistema
    safe_project_name = re.sub(r'[^\w\s-]', '', project_name).strip().replace(' ', '_')
    project_path = os.path.join(app.config['UPLOAD_FOLDER'], safe_project_name)

    if os.path.isdir(project_path):
        try:
            shutil.rmtree(project_path) # Elimina la cartella e tutto il suo contenuto
            return jsonify({'status': 'success', 'message': f'Progetto "{safe_project_name}" eliminato con successo.'})
        except OSError as e:
            return jsonify({'status': 'error', 'message': f'Errore durante l\'eliminazione del progetto: {e}'}), 500
    else:
        return jsonify({'status': 'error', 'message': f'Impossibile trovare il progetto "{safe_project_name}".'}), 404

@app.route('/duplicate_project/<string:project_name>', methods=['POST'])
def duplicate_project(project_name):
    """Crea una copia di un progetto esistente con un nome unico."""
    safe_project_name = re.sub(r'[^\w\s-]', '', project_name).strip().replace(' ', '_')
    original_path = os.path.join(app.config['UPLOAD_FOLDER'], safe_project_name)

    if not os.path.isdir(original_path):
        return jsonify({'status': 'error', 'message': 'Progetto originale non trovato.'}), 404

    # Leggi il nome visualizzato originale dal manifest per usarlo come base
    original_display_name = project_name
    original_manifest_path = os.path.join(original_path, 'manifest.json')
    if os.path.isfile(original_manifest_path):
        try:
            with open(original_manifest_path, 'r', encoding='utf-8') as f:
                original_display_name = json.load(f).get('name', project_name)
        except (IOError, json.JSONDecodeError):
            pass

    # Trova un nome unico per la cartella del progetto duplicato
    copy_number = 1
    while True:
        new_safe_name = f"{safe_project_name}_copia_{copy_number}"
        new_project_path = os.path.join(app.config['UPLOAD_FOLDER'], new_safe_name)
        if not os.path.exists(new_project_path):
            break
        copy_number += 1

    # Copia la cartella del progetto
    try:
        shutil.copytree(original_path, new_project_path)
    except OSError as e:
        return jsonify({'status': 'error', 'message': f'Errore durante la copia del progetto: {e}'}), 500

    # Aggiorna il manifest.json del nuovo progetto con il nuovo nome
    new_manifest_path = os.path.join(new_project_path, 'manifest.json')
    if os.path.isfile(new_manifest_path):
        try:
            with open(new_manifest_path, 'r+', encoding='utf-8') as f:
                manifest_data = json.load(f)
                manifest_data['name'] = f"{original_display_name} Copia {copy_number}"
                f.seek(0); json.dump(manifest_data, f, indent=4, ensure_ascii=False); f.truncate()
        except (IOError, json.JSONDecodeError) as e:
            print(f"Attenzione: non è stato possibile aggiornare il manifest per il progetto duplicato {new_safe_name}. Errore: {e}")

    return jsonify({'status': 'success', 'message': f'Progetto duplicato con successo.'})

@app.route('/export_project/<string:project_name>')
def export_project(project_name):
    """Comprime la cartella di un progetto in un file .zip e lo invia per il download."""
    project_path = os.path.join(app.config['UPLOAD_FOLDER'], project_name)

    if not os.path.isdir(project_path):
        flash(f'Progetto "{project_name}" non trovato.', 'error')
        return redirect(url_for('dashboard'))

    # Crea un file zip in memoria per evitare di scrivere file temporanei su disco
    memory_file = io.BytesIO()
    with zipfile.ZipFile(memory_file, 'w', zipfile.ZIP_DEFLATED) as zf:
        for root, dirs, files in os.walk(project_path):
            for file in files:
                file_path = os.path.join(root, file)
                # Crea un percorso relativo per i file all'interno dell'archivio zip
                archive_path = os.path.relpath(file_path, project_path)
                zf.write(file_path, archive_path)
    memory_file.seek(0)

    return send_file(
        memory_file,
        download_name=f'{project_name}.zip',
        as_attachment=True
    )

#if __name__ == '__main__':
    # Crea le tabelle del database se non esistono già.
    # Questo va eseguito una sola volta all'avvio dell'applicazione.
#    with app.app_context():
#        db.create_all()
#        print("Database inizializzato e tabelle create (se non esistenti).")

    # Avvia il server di sviluppo di Flask
#    app.run(debug=True)

application = app