import os
from pathlib import Path

import requests
import streamlit as st
import streamlit.components.v1 as components
from dotenv import load_dotenv


PROJECT_ROOT = Path(__file__).resolve().parent
load_dotenv(PROJECT_ROOT / '.env.local')
load_dotenv(PROJECT_ROOT / '.env')
API_URL = os.getenv('LOCAL_API_URL', 'http://127.0.0.1:8000').rstrip('/')
LANGUAGES = {
    'en': 'English', 'es': 'Spanish', 'fr': 'French', 'de': 'German',
    'hi': 'Hindi', 'ta': 'Tamil', 'zh': 'Chinese', 'ja': 'Japanese', 'la': 'Latin',
}

st.set_page_config(page_title='AI Translation Service', page_icon='🌐', layout='wide')
st.title('AI Translation Service')


def api_request(method, path, **kwargs):
    token = st.session_state.get('session_token')
    headers = {'Authorization': f'Bearer {token}'} if token else {}
    response = requests.request(method, API_URL + path, headers=headers, timeout=10, **kwargs)
    response.raise_for_status()
    return response


def show_api_error(error):
    if isinstance(error, requests.HTTPError):
        try:
            detail = error.response.json().get('detail', 'The request failed.')
        except ValueError:
            detail = 'The job service returned an unexpected response.'
        if isinstance(detail, list):
            detail = ' '.join(item.get('msg', 'Invalid input.') for item in detail)
        st.error(str(detail))
    else:
        st.error('The local job service could not be reached. Start it using run_local.py.')


try:
    auth_response = requests.get(API_URL + '/auth/config', timeout=5)
    auth_response.raise_for_status()
    auth_config = auth_response.json()
except (requests.RequestException, ValueError):
    st.error('Start the local job service before using the app.')
    st.code(r'..\venv\Scripts\python.exe run_local.py', language='powershell')
    st.stop()

if auth_config['mode'] == 'demo':
    st.warning('Local demo mode — sign-in is disabled and all jobs belong to this computer\'s demo user.')
    st.session_state.session_token = None
else:
    if not auth_config['configured']:
        st.info('Pull Clerk development keys into .env.local, or add CLERK_PUBLISHABLE_KEY and CLERK_ISSUER to .env. Then restart the app.')
        st.stop()
    clerk_login = components.declare_component('clerk_login', path=str(PROJECT_ROOT / 'frontend' / 'clerk'))
    session = clerk_login(publishable_key=auth_config['publishable_key'], key='clerk-session', default=None)
    st.session_state.session_token = session.get('token') if session else None
    if not st.session_state.session_token:
        st.info('Sign in to submit and view your translation jobs.')
        st.stop()

try:
    user_id = api_request('GET', '/auth/me').json()['user_id']
except requests.RequestException as error:
    show_api_error(error)
    st.stop()

if st.session_state.get('job_owner') != user_id:
    st.session_state.job_owner = user_id
    st.session_state.pop('selected_job_id', None)
    st.session_state.pop('downloads', None)

input_mode = st.radio('Input', ['Paste text', 'Upload .txt'], horizontal=True)
with st.form('translation-form'):
    left, right = st.columns(2)
    with left:
        source_language = st.selectbox(
            'Source language', ['auto', *LANGUAGES],
            format_func=lambda code: 'Auto-detect' if code == 'auto' else LANGUAGES[code],
        )
    with right:
        target_language = st.selectbox('Target language', list(LANGUAGES), index=1,
                                       format_func=LANGUAGES.get)
    if input_mode == 'Upload .txt':
        uploaded_file = st.file_uploader('Choose a UTF-8 text file', type=['txt'])
        text_input = ''
    else:
        uploaded_file = None
        text_input = st.text_area('Enter text to translate', height=180)
    st.caption('Maximum input size is 10,000 UTF-8 bytes. Translation uses online AWS and Gemini services.')
    submitted = st.form_submit_button('Translate', type='primary')

if submitted:
    try:
        if source_language == target_language:
            st.warning('Choose different source and target languages.')
        elif input_mode == 'Upload .txt' and uploaded_file is None:
            st.warning('Choose a .txt file first.')
        elif input_mode == 'Paste text' and not text_input.strip():
            st.warning('Enter some text first.')
        elif uploaded_file is not None:
            job = api_request('POST', '/jobs/upload',
                files={'file': (uploaded_file.name, uploaded_file.getvalue(), 'text/plain')},
                data={'source_language': source_language, 'target_language': target_language},
            ).json()
            st.session_state.selected_job_id = job['job_id']
            st.success('Translation job submitted.')
        else:
            job = api_request('POST', '/jobs', json={
                'text': text_input, 'source_language': source_language,
                'target_language': target_language,
            }).json()
            st.session_state.selected_job_id = job['job_id']
            st.success('Translation job submitted.')
    except requests.RequestException as error:
        show_api_error(error)


@st.fragment(run_every=2)
def show_jobs():
    try:
        jobs = api_request('GET', '/jobs').json()['jobs']
        st.subheader('Your translation jobs')
        if not jobs:
            st.info('Submit text or a file to create your first job.')
            return
        by_id = {job['job_id']: job for job in jobs}
        if st.session_state.get('selected_job_id') not in by_id:
            st.session_state.selected_job_id = jobs[0]['job_id']
        job_id = st.selectbox(
            'Select a job', list(by_id), key='selected_job_id',
            format_func=lambda value: (
                f"{by_id[value]['file_name']} · {by_id[value]['target_language']} · "
                f"{by_id[value]['status']} · {value[:8]}"
            ),
        )
        job = api_request('GET', f'/jobs/{job_id}').json()
        st.caption(f"Job ID {job_id} · Attempt {job['attempt_count']}")
        st.write('Status', job['status'])
        if job['status'] in {'queued', 'processing'}:
            st.info('Translation is in progress. This view updates automatically.')
            if job['error']:
                st.warning('A temporary service failure occurred. The job is waiting for an automatic retry.')
            return
        if job['status'] == 'failed':
            st.error(job['error']['message'])
            st.caption(f"Error code {job['error']['code']}")
            if st.button('Retry job', key=f'retry-{job_id}'):
                api_request('POST', f'/jobs/{job_id}/retry')
                st.rerun(scope='fragment')
            return
        result = job['result']
        st.text_area('Translated text', result['translated_text'], height=180,
                     key=f'result-{job_id}', disabled=True)
        st.write('Detected source language', result['source_language'])
        st.write('Detected domain', result['detected_domain'])
        st.write('Translation source', result['translation_source'])
        st.subheader('Quality report')
        report = result['quality_report']
        if 'Automated quality evaluation was unavailable.' in report.get('flagged_issues', []):
            st.warning('Quality evaluation was unavailable. Review the translation manually.')
        st.json(report)
        downloads = st.session_state.setdefault('downloads', {})
        if job_id not in downloads:
            downloads[job_id] = {
                'text': api_request('GET', f'/jobs/{job_id}/result').content,
                'report': api_request('GET', f'/jobs/{job_id}/result', params={'format': 'json'}).content,
            }
        left, right = st.columns(2)
        with left:
            st.download_button('Download translation', downloads[job_id]['text'],
                               file_name=f'{job_id}-translated.txt', mime='text/plain', key=f'text-{job_id}')
        with right:
            st.download_button('Download quality report', downloads[job_id]['report'],
                               file_name=f'{job_id}-report.json', mime='application/json', key=f'report-{job_id}')
    except requests.RequestException as error:
        show_api_error(error)


show_jobs()
