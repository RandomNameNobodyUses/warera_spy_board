import './countrystatsdashboard.css';

// Konstante für die Timer-Planung (90%)
const DEBUFF_TARGET_PERCENTILE = 0.9;

export default function CountryStatsDashboard({ countryStats }) {

  if (!countryStats) return null;

  const now = new Date();

  // ==========================================================================
  // 1. Zeitgesteuerte Verteilungen (24h) berechnen
  // ==========================================================================
  const debuffHourlyDistribution = Array(24).fill(0);
  const buffHourlyDistribution = Array(24).fill(0);
  const debuffEndTimes = [];

  // Verteilung für Buffs ermitteln
  if (countryStats.pillenTimestamps?.imBuff) {
    countryStats.pillenTimestamps.imBuff.forEach(timestamp => {
      const date = new Date(timestamp);
      if (date > now) {
        buffHourlyDistribution[date.getHours()]++;
      }
    });
  }

  // Verteilung für Debuffs ermitteln
  if (countryStats.pillenTimestamps?.imDebuff) {
    countryStats.pillenTimestamps.imDebuff.forEach(timestamp => {
      const date = new Date(timestamp);
      if (date > now) {
        debuffEndTimes.push(date);
        debuffHourlyDistribution[date.getHours()]++;
      }
    });
  }

  // Perzentil-Timer berechnen (Wann sind X% der Leute ready?)
  let percentileTimerStr = "--:--";
  if (debuffEndTimes.length > 0) {
    debuffEndTimes.sort((a, b) => a.getTime() - b.getTime());
    const targetIndex = Math.min(
      debuffEndTimes.length - 1,
      Math.max(0, Math.floor(debuffEndTimes.length * DEBUFF_TARGET_PERCENTILE))
    );
    percentileTimerStr = debuffEndTimes[targetIndex].toLocaleTimeString('de-DE', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
  }

  // Rotations-Reihenfolge der Stunden für die X-Achse (Beginnend bei aktueller Stunde)
  const currentHour = now.getHours();
  const hoursOrder = Array.from({ length: 24 }, (_, i) => (currentHour + i) % 24);

  const maxBuffPlayers = Math.max(...buffHourlyDistribution, 1);
  const maxDebuffPlayers = Math.max(...debuffHourlyDistribution, 1);

  return (
    <div className="stats-dashboard">
      <div className="stats-title-wrapper">
        {countryStats.flagCode && (
          <img 
            src={`/src/components/flags/${countryStats.flagCode.toLowerCase()}.svg`} 
            alt="" 
            className="dashboard-heading-flag"
          />
        )}
        <h2>Statistiken für {countryStats.countryName}</h2>
      </div>
      
      <hr className="divider" />

      {/* Grid Boxen */}
      <div className="division-stats-grid">
        <StatsGrid 
          countryStats={countryStats} 
          percentileTimerStr={percentileTimerStr} 
        />
      </div>

      {/* Diagramme & Statusbalken direkt eingebunden (ohne Button & isExpanded Bedingung) */}
      <div className="division-expanded-details-wrapper">
        
        {/* Buff Diagramm */}
        <div className="division-chart-container section-spacing">
          <div className="chart-header-with-info">
            <h4 className="chart-title">Buff-Ende Verteilung (24h)</h4>
            <span className="chart-info-icon" title="Zeigt an, in welcher Stunde des Tages wie viele aktive Buffs auslaufen.">ⓘ</span>
          </div>
          <div className="mu-24h-chart">
            {hoursOrder.map(hour => (
              <HourlyBarChart 
                key={`buff-${hour}`}
                hour={hour}
                count={buffHourlyDistribution[hour]}
                maxCount={maxBuffPlayers}
                fillClass="buff-fill"
                tooltipSuffix="Buffs laufen aus"
              />
            ))}
          </div>
        </div>

        {/* Debuff Diagramm */}
        <div className="division-chart-container">
          <div className="chart-header-with-info">
            <h4 className="chart-title">Debuff-Ende Verteilung (24h)</h4>
            <span className="chart-info-icon" title="Zeigt an, in welcher Stunde des Tages wie viele Spieler aus dem Debuff kommen.">ⓘ</span>
          </div>
          <div className="mu-24h-chart">
            {hoursOrder.map(hour => (
              <HourlyBarChart 
                key={`debuff-${hour}`}
                hour={hour}
                count={debuffHourlyDistribution[hour]}
                maxCount={maxDebuffPlayers}
                fillClass="debuff-fill"
                tooltipSuffix="Spieler kommen aus dem Debuff"
              />
            ))}
          </div>
        </div>

        {/* Aggregierte Kapazitäten / Statusbalken */}
        {countryStats.totalRelevantUsers > 0 && (
          <div className="mu-status-bars-column">
            <div className="chart-header-with-info header-margin-bottom">
              <h4 className="chart-title reset-margin">Gefechtsbereite Gesamtkapazität</h4>
              <span className="chart-info-icon help-cursor" title="Hier wird die absolute Kampfkraft des Landes summiert (War/Hybrid Einheiten).">ⓘ</span>
            </div>

            <StatusBar 
              label="Overall Gesamt"
              current={countryStats.totals?.currentOverall}
              max={countryStats.totals?.maxOverall}
              percent={countryStats.percentages?.overall}
              fillClass="fill-overall"
            />

            <StatusBar 
              label="Health Gesamt"
              current={countryStats.totals?.currentHealth}
              max={countryStats.totals?.maxHealth}
              percent={countryStats.percentages?.health}
              fillClass="fill-health"
            />

            <StatusBar 
              label="Hunger Gesamt"
              current={countryStats.totals?.currentHunger}
              max={countryStats.totals?.maxHunger}
              percent={countryStats.percentages?.hunger}
              fillClass="fill-hunger"
            />
          </div>
        )}

      </div>
    </div>
  );
}

// ==========================================================================
// 2. Sub-Komponente: Raster-Zusammenfassung (StatsGrid)
// ==========================================================================
function StatsGrid({ countryStats, percentileTimerStr }) {
  const userCount = countryStats.totalRelevantUsers || 0;
  const inBuff = countryStats.pillenStats?.imBuff || 0;
  const inDebuff = countryStats.pillenStats?.imDebuff || 0;

  const stats = [
    { label: "War/Hybrid Einheiten", value: userCount },
    { label: "Im Buff", value: `${inBuff} (${userCount ? Math.round((inBuff / userCount) * 100) : 0}%)` },
    { label: "Im Debuff", value: `${inDebuff} (${userCount ? Math.round((inDebuff / userCount) * 100) : 0}%)` },
    { label: "Keine Pille", value: countryStats.pillenStats?.keinePille || 0 },
    { label: `Kriegspfad (War)`, value: countryStats.skillpathDist?.War || 0 },
    { label: `90% Ready um`, value: percentileTimerStr, highlight: true },
  ];

  return stats.map((stat, index) => (
    <div key={index} className={`division-stat-box ${stat.highlight ? 'stat-highlight' : ''}`}>
      <span className="division-stat-label">{stat.label}:</span>
      <span className="division-stat-value">{stat.value}</span>
    </div>
  ));
}

// ==========================================================================
// 3. Sub-Komponente: Säule des Balkendiagramms (HourlyBarChart)
// ==========================================================================
function HourlyBarChart({ hour, count, maxCount, fillClass, tooltipSuffix }) {
  const barHeightPercent = (count / maxCount) * 100;
  const hourStr = String(hour).padStart(2, '0');
  const tooltipText = `${hourStr}:00 - ${hourStr}:59 Uhr\n${count} ${tooltipSuffix}`;

  return (
    <div className="chart-bar-wrapper" title={tooltipText}>
      <div className="chart-bar-value-label">{count > 0 ? count : ''}</div>
      <div className="chart-bar-bg">
        <div 
          className={`chart-bar-fill ${fillClass} ${count > 0 ? 'has-value' : ''}`} 
          style={{ height: `${barHeightPercent}%` }}
        />
      </div>
      <div className="chart-bar-hour-label">{hourStr}</div>
    </div>
  );
}

// ==========================================================================
// 4. Sub-Komponente: Einzelner Statusbalken (StatusBar)
// ==========================================================================
function StatusBar({ label, current, max, percent, fillClass }) {
  const roundedPercent = Math.round(percent || 0);
  return (
    <div className="mu-status-bar-wrapper">
      <div className="mu-status-bar-labels">
        <span className="mu-status-bar-name">{label}</span>
        <span className="mu-status-bar-value">{Math.round(current || 0).toLocaleString()} / {Math.round(max || 0).toLocaleString()}</span>
      </div>
      <div className="mu-status-bar-bg">
        <div className={`mu-status-bar-fill ${fillClass}`} style={{ width: `${percent}%` }}>
          {percent >= 12 && <span className="mu-bar-percent-inside">{roundedPercent}%</span>}
        </div>
      </div>
    </div>
  );
}