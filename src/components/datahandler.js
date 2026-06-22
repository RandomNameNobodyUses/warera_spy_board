import { getWarEraClient } from './apiwrapper.js';

// ==========================================================================
// ZENTRALE BASISKLASSE (Zustand-Weiterleitung, Cache-Steuerung & Mappers)
// ==========================================================================
class BaseSubHandler {
  constructor(parent, cacheType) {
      this.parent = parent;       
      this.cacheType = cacheType;   
  }

  get forceUpdate() {
      return this.parent.forceUpdate;
  }

  set forceUpdate(value) {
      this.parent.forceUpdate = value;
  }

  get cacheConfig() {
      const CONFIG = {
          ARTICLE: { prefix: 'article_cache', duration: 5 * 60 * 1000 },
          MU:      { prefix: 'mu_cache',      duration: 15 * 60 * 1000 },
          USER:    { prefix: 'user_cache',    duration: 5 * 60 * 1000 },
          COUNTRY: { prefix: 'countries_cache', duration: 24 * 60 * 60 * 1000 },
          LAYOUT:  { prefix: 'custom_layout', duration: Infinity }
      };
      return CONFIG[this.cacheType];
  }

  getCacheKey(id = null) {
      const prefix = this.cacheConfig.prefix;
      return id ? `${prefix}_${id}` : `${prefix}`;
  }

  getCacheData(id = null) {
      if (this.forceUpdate) return null;

      try {
          const cacheKey = this.getCacheKey(id);
          const cached = localStorage.getItem(cacheKey);
          if (!cached) return null;

          const { data, timestamp } = JSON.parse(cached);
          const duration = this.cacheConfig.duration;

          if (duration === Infinity || (Date.now() - timestamp < duration)) {
              return data;
          }
          
          localStorage.removeItem(cacheKey);
          return null;
      } catch (error) {
          console.error(`Fehler beim Lesen aus dem Cache (${this.cacheType}):`, error);
          return null;
      }
  }

  setCacheData(id, data) {
      try {
          const cacheKey = this.getCacheKey(id);
          const cacheObj = { data, timestamp: Date.now() };
          localStorage.setItem(cacheKey, JSON.stringify(cacheObj));
      } catch (error) {
          console.error(`Fehler beim Schreiben in den Cache (${this.cacheType}):`, error);
      }
  }

  //===============================================
  // Mapper Helpers

  calculateTotalSkillPoints(level) {
      
      if (!level || level <= 0) return 0;
      
      return (level * (level + 1)) / 2;
  }

  decimalAdjust(type, value, exp) {
      if (typeof exp === 'undefined' || +exp === 0) {
        return Math[type](value);
      }
      value = +value;
      exp = +exp;
      // If the value is not a number or the exp is not an integer...
      if (isNaN(value) || !(typeof exp === 'number' && exp % 1 === 0)) {
        return NaN;
      }
      // Shift
      value = value.toString().split('e');
      value = Math[type](+(value[0] + 'e' + (value[1] ? (+value[1] - exp) : -exp)));
      // Shift back
      value = value.toString().split('e');
      return +(value[0] + 'e' + (value[1] ? (+value[1] + exp) : exp));
    }


  //============================================
  // CENTRALIZED FORMATTERS (MAPPERS)


 
  mapCountryData(apiData) {
    return {
        _id: apiData._id,
        name: apiData.name,
        code: apiData.code,
        money: apiData.money,
    };


  }

  mapUserData(apiData, calculatedFlagCode = "") {
      const basepath = apiData.skills;
      let skillpath = '';
      if (basepath) {
          const warSkillPathPoints =      this.calculateTotalSkillPoints(basepath.attack?.level) +  
                                          this.calculateTotalSkillPoints(basepath.precision?.level) + 
                                          this.calculateTotalSkillPoints(basepath.criticalChance?.level) +
                                          this.calculateTotalSkillPoints(basepath.criticalDamages?.level) + 
                                          this.calculateTotalSkillPoints(basepath.armor?.level) +
                                          this.calculateTotalSkillPoints(basepath.dodge?.level) + 
                                          this.calculateTotalSkillPoints(basepath.health?.level) +
                                          this.calculateTotalSkillPoints(basepath.lootChance?.level) +
                                          this.calculateTotalSkillPoints(basepath.hunger?.level);

          const ecoSkillPathPoints =      this.calculateTotalSkillPoints(basepath.energy?.level) + 
                                          this.calculateTotalSkillPoints(basepath.companies?.level) +
                                          this.calculateTotalSkillPoints(basepath.entrepreneurship?.level) + 
                                          this.calculateTotalSkillPoints(basepath.production?.level) +
                                          this.calculateTotalSkillPoints(basepath.management?.level);

          const totalSkillPathPoints = ecoSkillPathPoints + warSkillPathPoints;
                                          
          const userLevel = apiData.leveling?.level || 0;
          
          if (userLevel > 20) { 
              if (warSkillPathPoints > (totalSkillPathPoints * 0.75)) {
                  skillpath = 'War';
              } else if (ecoSkillPathPoints > (totalSkillPathPoints * 0.75)) {
                  skillpath = 'Eco';
              }else{
                  skillpath = 'Hybrid'
              }
          }else{
              skillpath = 'Aufbau';
          }
      }
      //Stats für Balken

      const currentHealth = this.decimalAdjust("round", apiData.skills?.health?.currentBarValue, -1) || 0;
      const totalHealth   = apiData.skills?.health?.value || 100;
      
      const currentHunger = this.decimalAdjust("round", apiData.skills?.hunger?.currentBarValue, -1) || 0;
      const totalHunger   = apiData.skills?.hunger?.value || 100;

      const currentOverall = Math.round((currentHealth + currentHealth * (currentHunger * 0.15)) * 10) / 10;
      const totalOverall   = Math.round((totalHealth + totalHealth * (totalHunger * 0.15)) * 10) / 10;

      // Prozentuale Breiten für die visuelle Darstellung (0 - 100)
      const healthPercent  = Math.min(100, Math.max(0, (currentHealth / totalHealth) * 100));
      const hungerPercent  = Math.min(100, Math.max(0, (currentHunger / totalHunger) * 100));
      const overallPercent = Math.min(100, Math.max(0, (currentOverall / totalOverall) * 100));
      return {
          _id: apiData._id,
          country: calculatedFlagCode,
          level: apiData.leveling?.level,
          isActive: apiData.isActive,
          skillpath: skillpath || 'Fehler',
          skills: {
              "health": {
                  "currentBarValue": currentHealth,
                  "value": totalHealth,
                  "percent": healthPercent
              },
              "hunger": {
                  "currentBarValue": currentHunger,
                  "value": totalHunger,
                  "percent": hungerPercent
              },
              "overall": {
                  "currentBarValue": currentOverall,
                  "value": totalOverall,
                  "percent": overallPercent
              }
          },
          buffs:{
              "buffCodes": apiData.buffs?.buffCodes || [],
              "buffEndAt": apiData.buffs?.buffEndAt ? new Date(apiData.buffs.buffEndAt) : null,
              "debuffCodes": apiData.buffs?.debuffCodes || [],
              "debuffEndAt": apiData.buffs?.debuffEndAt ? new Date(apiData.buffs.debuffEndAt) : null,
          },
          
      };
  }
}
/// ==========================================================================
// SUB-HANDLER FÜR LÄNDER & STATS-AGGREGATION (KORRIGIERT MIT CACHE-METHODEN)
// ==========================================================================
class CountryHandler extends BaseSubHandler {
    constructor(parent) {
        super(parent, 'COUNTRY');
    }
  
    /**
     * Holt alle Länder aus der API (bzw. dem Cache) für das Dropdown.
     */
    async getAllCountries() {
        const cacheId = 'list_all';
        
        // Nutzt jetzt deine Basis-Funktion (beachtet forceUpdate und fügt Prefix an)
        const cached = this.getCacheData(cacheId);
        if (cached) return cached;
  
        try {
            const response = await this.parent.client.country.getAllCountries(); 
            const countryData = response?.result?.data || response;
            const formatedCountrys = countryData.map(country => this.mapCountryData(country));
            
            // Speichert über deine Basis-Funktion
            this.setCacheData(cacheId, formatedCountrys);
            return formatedCountrys;
        } catch (error) {
            console.error("Fehler beim Laden der Länder-Liste:", error);
            throw error;
        }
    }

    /**
     * Sucht ein bestimmtes Land anhand der ID aus der Liste/dem Cache.
     * Verhindert unnötige Netzwerk-Anfragen.
     */
    async getCountryById(countryId) {
        // Holt die (gecacgten oder frischen) Länder
        const allCountries = await this.getAllCountries();
        
        // Findet das Land in der Liste anhand der _id
        const country = allCountries.find(c => c._id === countryId);
        
        if (!country) {
            console.warn(`Land mit ID ${countryId} wurde in der Liste nicht gefunden.`);
            return null;
        }
        return country;
    }

    // TODO: Check
    /**
     * Holt alle User eines Landes über deren IDs, filtert sie und berechnet kumulierte Statistiken.
     * Speichert das aggregierte Endergebnis ab, statt die Einzel-User zu belasten.
     */
    async getAggregatedStats(countryId) { 
        const cacheId = `aggregated_${countryId}`;
        
        // Nutzt deine Basis-Funktion (beachtet forceUpdate und fügt Prefix an)
        const cached = this.getCacheData(cacheId);
        if (cached) return cached;
    
        try {
            const countryDetails = await this.getCountryById(countryId);
            const flagCode = countryDetails?.code || "unknown";
            const countryName = countryDetails?.name || "Unbekanntes Land";

            let flatItems = [];
            // 1. Paginierte API-Antwort für die User des Landes holen
            for await (const page of this.parent.client.user.getUsersByCountry({ 
                countryId: countryId,
                limit: 100,
                autoPaginate: true
            })){
                // Da du hier direkt page.items (oder page?.result?.data?.items je nach API) pushst:
                const items = page?.items || page?.result?.data?.items || [];
                flatItems.push(...items);
            } 
            
            // Nur die IDs extrahieren
            const userIds = flatItems.map(item => item._id);
    
            // Falls keine User im Land sind, brechen wir hier frühzeitig mit leeren Stats ab
            if (userIds.length === 0) {
                const emptyStats = this._getInitialStatsObject(countryId);
                this.setCacheData(cacheId, emptyStats);
                return emptyStats;
            }
    
            // Daten-Struktur für die kumulierten Werte initialisieren
            let stats = this._getInitialStatsObject(countryId, flagCode);
            stats.countryName = countryName; 
            

            //########################################################################
            // 2. PARALLELISIERUNG: Alle User-Requests gleichzeitig abfeuern
    
            const userPromises = userIds.map(userId => 
                this.parent.client.user.getUserById({ userId })
                    .catch(err => {
                        console.error(`Fehler beim Laden von User ${userId}:`, err);
                        return null; // Verhindert, dass das gesamte Promise.all bei einem Fehler abbricht
                    })
            );
            
            const userResponses = await Promise.all(userPromises);
    
            // 3. Die geladenen User synchron filtern und aufsummieren
            userResponses.forEach(userResponse => {
                if (!userResponse) return; // Fehlgeschlagene Requests überspringen
    
                // Daten aus tRPC Response extrahieren (falls tiefer verschachtelt)
                const rawUserData = userResponse?.result?.data || userResponse;
    
                // Mappen durch die Logik der Basisklasse (berechnet Skillpfade, Balkenwerte etc.)
                const user = this.mapUserData(rawUserData);
    
                // RELEVANZ-FILTER: Nur aktive Spieler mit mindestens Level 20 berücksichtigen
                const isRelevant = user.isActive && (user.skillpath === 'War' || user.skillpath === 'Hybrid')
                if (!isRelevant) return;
    
                stats.totalRelevantUsers++;
    
                // Skillpfad-Verteilung mitzählen
                if (stats.skillpathDist[user.skillpath] !== undefined) {
                    stats.skillpathDist[user.skillpath]++;
                }
    
                // Kampf- & Survival-Stats aufsummieren
                stats.totals.currentHealth += user.skills.health.currentBarValue;
                stats.totals.maxHealth     += user.skills.health.value;
                
                stats.totals.currentHunger += user.skills.hunger.currentBarValue;
                stats.totals.maxHunger     += user.skills.hunger.value;
                
                stats.totals.currentOverall += user.skills.overall.currentBarValue;
                stats.totals.maxOverall     += user.skills.overall.value;
    
                // Pillen / Buff-Stats ermitteln
                const hatBuff = user.buffs.buffCodes && user.buffs.buffCodes.length > 0;
                const hatDebuff = user.buffs.debuffCodes && user.buffs.debuffCodes.length > 0;
    
                if (!hatBuff && !hatDebuff) {
                    stats.pillenStats.keinePille++;
                }
                if (hatBuff){
                    stats.pillenStats.imBuff++;
                    stats.pillenTimestamps.imBuff.push(user.buffs.buffEndAt)
                };
                if (hatDebuff) {
                    stats.pillenStats.imDebuff++;
                    stats.pillenTimestamps.imDebuff.push(user.buffs.debuffEndAt);
                };
            });
    
            // 4. Prozentuale Breiten für die globalen UI-Balken errechnen
            stats.percentages = {
                health: stats.totals.maxHealth > 0 ? (stats.totals.currentHealth / stats.totals.maxHealth) * 100 : 0,
                hunger: stats.totals.maxHunger > 0 ? (stats.totals.currentHunger / stats.totals.maxHunger) * 100 : 0,
                overall: stats.totals.maxOverall > 0 ? (stats.totals.currentOverall / stats.totals.maxOverall) * 100 : 0
            };
    
            // Runden auf eine Nachkommastelle für saubere UI-Darstellung
            for (let key in stats.percentages) {
                stats.percentages[key] = Math.round(stats.percentages[key] * 10) / 10;
            }
    
            // Speichert das fertig aggregierte Objekt über deine Basis-Funktion im Cache
            this.setCacheData(cacheId, stats);
            return stats;
    
        } catch (error) {
            console.error(`Fehler bei der Stats-Aggregation für Land ${countryId}:`, error);
            throw error;
        }
    }

    /**
     * Hilfsmethode zur Bereitstellung eines leeren Statistik-Skeletts
     * @private
     */
    _getInitialStatsObject(countryId, flagCode) {
        return {
            countryId,
            flagCode,
            countryName: "",
            totalRelevantUsers: 0,
            pillenStats: {
                keinePille: 0,
                imBuff: 0,
                imDebuff: 0
            },
            pillenTimestamps:{
                imBuff: [],
                imDebuff: [],
            },
            totals: {
                currentHealth: 0,
                maxHealth: 0,
                currentHunger: 0,
                maxHunger: 0,
                currentOverall: 0,
                maxOverall: 0
            },
            skillpathDist: {
                War: 0,
                Hybrid: 0,
            },
            percentages: {
                health: 0,
                hunger: 0,
                overall: 0
            }
        };
    }
  }

  // ==========================================================================
// CENTRAL DATA HANDLER (Der Orchestrator / Einstiegspunkt für React)
// ==========================================================================
export class DataHandler {
  constructor(forceUpdate = false) {

      this._forceUpdate = forceUpdate;
      // Initiale Werte sicher laden
      this._apiKey = this._safeGetLocalStorage('warera_api_key', '');

      // API-Client initialisieren
      this.client = getWarEraClient();
    	
      this.countries = new CountryHandler(this);
      /*
      // Sub-Handler registrieren
      this.articles = new ArticleHandler(this);
      this.countries = new CountryHandler(this);
      this.mus = new MuHandler(this);
      this.users = new UserHandler(this);
      this.layout = new LayoutHandler(this);
    */
  }
  validateAndCleanCache() {
      try {
          const handlers = [this.articles, this.countries, this.mus, this.users, this.layout];
          Object.keys(localStorage).forEach(storageKey => {
              const passenderHandler = handlers.find(h => storageKey.startsWith(h.cacheConfig.prefix));
              if (!passenderHandler) return;
  
              const duration = passenderHandler.cacheConfig.duration;
              if (duration === Infinity) return;
  
              const rawItem = localStorage.getItem(storageKey);
              if (!rawItem) return;
  
              try {
                  const { timestamp } = JSON.parse(rawItem);
                  if (!timestamp || (Date.now() - timestamp >= duration)) {
                      localStorage.removeItem(storageKey);
                      console.log(`[Cache-Cleanup] Gelöscht: ${storageKey}`);
                  }
              } catch {
                  localStorage.removeItem(storageKey);
              }
          });
      } catch (e) {
          console.error("Fehler beim Initial-Cache-Cleanup:", e);
      }
  }

  // ==========================================
  // GETTER (Öffentlicher Lesezugriff)
  // ==========================================
  get apiKey() {
      return this._apiKey;
  }
  
  // API-Key einzeln verwalten
  saveApiKey(newKey) {
      try {
          const finalKey = newKey.trim();
          localStorage.setItem('warera_api_key', finalKey);
          this._apiKey = finalKey;
          this.updateClient(); // Client neu bauen, da sich die Rechte geändert haben
      } catch (error) {
          console.error("Fehler beim Speichern des API-Keys:", error);
          throw error;
      }
  }

  clearApiKey() {
      try {
          localStorage.removeItem('warera_api_key');
          this._apiKey = '';
          this.updateClient();
      } catch (error) {
          console.error("Fehler beim Löschen des API-Keys:", error);
      }
  }

  get forceUpdate() {
      return this._forceUpdate;
  }

  set forceUpdate(value) {
      this._forceUpdate = !!value;
  }

  setForceUpdate(forceUpdate = false) {
      this.forceUpdate = forceUpdate;
  }

  updateClient() {
      this.client = getWarEraClient();
  }

  _safeGetLocalStorage(key, defaultValue) {
      try {
          const item = localStorage.getItem(key);
          return item !== null ? item : defaultValue;
      } catch (error) {
          console.error(`Fehler beim sicheren Lesen von ${key} aus dem LocalStorage:`, error);
          return defaultValue;
      }
  }  
  // Öffentliche Schnittstellen für React
  async getAggregatedStats(countryId, flagCode) {return await this.countries.getAggregatedStats(countryId, flagCode)}
  async getAllCountries(){return await this.countries.getAllCountries()}
}   