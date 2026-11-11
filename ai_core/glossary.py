GLOSSARY = {
    "Legal": {
        "Agreement": "Contrat",
        "Court": "Tribunal",
        "Contract": "Contrat",
        "Plaintiff": "Demandeur"
    },
    "Medical": {
        "Patient": "Patient",
        "Diagnosis": "Diagnostic",
        "Treatment": "Traitement",
        "Medicine": "Médicament"
    },
    "IT_Software": {
        "Database": "Base de données",
        "Software": "Logiciel",
        "Server": "Serveur",
        "Application": "Application"
    },
    "Finance": {
        "Revenue": "Revenu",
        "Investment": "Investissement",
        "Profit": "Bénéfice",
        "Tax": "Impôt"
    }
}


def get_domain_glossary(domain: str) -> dict:
    """Return glossary terms for a specific domain."""
    return GLOSSARY.get(domain, {})


def get_translation(term: str, domain: str):
    """Find the translated equivalent of a term."""
    glossary = get_domain_glossary(domain)

    for source_term, translated_term in glossary.items():
        if source_term.lower() == term.lower():
            return translated_term

    return None


def add_term(domain: str, source_term: str, translated_term: str):
    """Add a new term to a domain glossary."""
    if domain not in GLOSSARY:
        GLOSSARY[domain] = {}

    GLOSSARY[domain][source_term] = translated_term