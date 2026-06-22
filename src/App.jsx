import { useState, useEffect, useRef } from 'react';
import { DataHandler } from './components/datahandler.js';
import CountryStatsDashboard from './components/countrystatsdashboard.jsx'; // Das neue Dashboard laden
import './index.css';
import './App.css';

const dataHandler = new DataHandler();

function App() {
  const [countries, setCountries] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [selectedCountry, setSelectedCountry] = useState(null);
  
  const [countryStats, setCountryStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(false);

  const [apiKey, setApiKey] = useState(dataHandler.apiKey);
  const [apiKeyInput, setApiKeyInput] = useState(dataHandler.apiKey);
  const [isKeySaved, setIsKeySaved] = useState(!!dataHandler.apiKey);
  
  const wrapperRef = useRef(null);

  useEffect(() => {
    if (apiKey) {
      dataHandler.getAllCountries()
        .then(data => setCountries(data))
        .catch(err => console.error("Fehler beim Länder-Load:", err));
    } 
  }, [apiKey]);

  useEffect(() => {
    function handleClickOutside(event) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSaveKey = () => {
    if (!apiKeyInput.trim()) return;
    dataHandler.saveApiKey(apiKeyInput);
    setApiKey(dataHandler.apiKey);
    setIsKeySaved(true);
  };

  const handleClearKey = () => {
    dataHandler.clearApiKey();
    setApiKey('');
    setApiKeyInput('');
    setIsKeySaved(false);
    handleResetSelection();
  };

  const filteredCountries = countries.filter(country =>
    country.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSelectCountry = async (country) => {
    setSelectedCountry(country);
    setSearchQuery('');
    setIsOpen(false);
    
    setStatsLoading(true);
    setCountryStats(null);
    
    try {
      const stats = await dataHandler.getAggregatedStats(country._id);
      setCountryStats(stats);
    } catch (error) {
      console.error("Fehler beim Abrufen der Statistiken:", error);
    } finally {
      setStatsLoading(false);
    }
  };

  const handleResetSelection = () => {
    setSelectedCountry(null);
    setCountryStats(null);
    setSearchQuery('');
  };

  return (
    <div className="dashboard-container">
      {/* API KEY MANAGER */}
      <div className="api-key-container">
        {!isKeySaved ? (
          <div className="api-key-input-group">
            <input
              type="password"
              className="api-input"
              placeholder="WarEra API-Key hier einfügen..."
              value={apiKeyInput}
              onChange={(e) => setApiKeyInput(e.target.value)}
            />
            <button className="api-btn save" onClick={handleSaveKey}>Schlüssel Speichern</button>
          </div>
        ) : (
          <div className="api-key-status-group">
            <span className="api-status-badge active">✓ API-Verbindung aktiv</span>
            <button className="api-btn delete" onClick={handleClearKey}>Schlüssel wechseln</button>
          </div>
        )}
      </div>

      <h1>Landesstatistiken</h1>

      {!apiKey ? (
        <div className="key-warning-box">
          <p>Bitte hinterlege oben einen gültigen <strong>WarEra API-Key</strong>, um Daten abzufragen.</p>
        </div>
      ) : (
        <>
          {/* Autocomplete Wrapper */}
          <div className="autocomplete-wrapper" ref={wrapperRef}>
            {!selectedCountry ? (
              <input
                type="text"
                className="search-input"
                placeholder="Nach Land suchen..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setIsOpen(true);
                }}
                onFocus={() => setIsOpen(true)}
              />
            ) : (
              <div className="selected-country-badge">
                <div className="badge-info">
                  {/* Lokale SVG-Flagge für das ausgewählte Land geladen */}
                  {selectedCountry.code && (
                    <img 
                      src={`/src/components/flags/${selectedCountry.code.toLowerCase()}.svg`} 
                      alt="" 
                      className="country-flag-icon selection-badge-flag"
                      onError={(e) => e.target.style.display = 'none'}
                    />
                  )}
                  <strong className="country-title">{selectedCountry.name}</strong> 
                </div>
                <button onClick={handleResetSelection} className="reset-button" title="Auswahl aufheben">✖</button>
              </div>
            )}

            {isOpen && !selectedCountry && (
              <ul className="dropdown-list">
                {filteredCountries.length > 0 ? (
                  filteredCountries.map((country) => {
                    const flagCodeLower = country.code?.toLowerCase();

                    return (
                      <li key={country._id} className="dropdown-item" onClick={() => handleSelectCountry(country)}>
                        {/* Lokale SVG-Flagge für die Dropdown-Liste geladen */}
                        {flagCodeLower && (
                          <img 
                            src={`/src/components/flags/${flagCodeLower}.svg`} 
                            alt={`${country.name} Flag`} 
                            className="country-flag-icon"
                            onError={(e) => e.target.style.display = 'none'}
                          />
                        )}
                        <span className="country-dropdown-name">{country.name}</span>
                      </li>
                    );
                  })
                ) : (
                  <li className="no-results">Kein Land gefunden</li>
                )}
              </ul>
            )}
          </div>
          {/* Ladezustand */}
          {statsLoading && (
            <div className="loader">Analysiere Profile für {selectedCountry?.name}...</div>
          )}

          {/* Das ausgelagerte Statistik-Dashboard aufrufen */}
          <CountryStatsDashboard countryStats={countryStats} />
        </>
      )}
    </div>
  );
}

export default App;