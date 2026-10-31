describe('Expenses Tab — Spese Casa E2E', () => {
  beforeEach(() => {
    cy.visit('/');

    // Dismiss the loader overlay
    cy.get('app-loader-overlay app-button button').first().click({ force: true });
    cy.get('#loader-overlay').should('not.exist');

    cy.get('.tab-btn').contains('Spese').click();
    cy.get('app-expenses-tab').should('be.visible');
    cy.contains('Spese Casa').should('be.visible');
  });

  it('shows the dashboard with month navigation and total', () => {
    cy.get('app-expenses-tab').within(() => {
      cy.contains('Totale').should('be.visible');
      cy.contains('Trend ultimi 6 mesi').should('be.visible');
      cy.get('button[title="Vai al mese corrente"]').should('be.visible');
    });
  });

  it('switches to the Add panel and shows manual + Telegram forms', () => {
    cy.get('app-expenses-tab').within(() => {
      cy.contains('Aggiungi').click();
      cy.contains('Aggiunta manuale').should('be.visible');
      cy.contains('Da Telegram (chat privata)').should('be.visible');
      cy.contains('Bot Telegram (ricezione automatica)').should('be.visible');
    });
  });

  it('adds a manual expense and shows it in the list', () => {
    cy.get('app-expenses-tab').within(() => {
      cy.contains('Aggiungi').click();
      cy.get('input[placeholder="Es. Bolletta luce Enel"]').type('Bolletta luce');
      cy.get('input[type="number"]').first().type('45.5');
      cy.contains('Salva spesa').click();

      cy.contains('Dashboard').click();
      cy.contains('Bolletta luce').should('be.visible');
      cy.contains('45.50').should('be.visible');
    });
  });

  it('shows the Ask panel with a question input', () => {
    cy.get('app-expenses-tab').within(() => {
      cy.contains('Chiedi').click();
      cy.contains('Interroga le spese del mese').should('be.visible');
      cy.get(
        'textarea[placeholder="Quanto ho speso in cibo? Qual è la bolletta più alta?"]',
      ).should('be.visible');
    });
  });
});
