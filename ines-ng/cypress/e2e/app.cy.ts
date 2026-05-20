describe('INES Application', () => {
  beforeEach(() => {
    cy.visit('/');
  });

  it('should display the status bar and logo', () => {
    cy.get('app-status-bar').should('be.visible');
    cy.get('.brand-text').should('contain', 'INES');
  });

  it('should open the loader overlay on load', () => {
    cy.get('app-loader-overlay').should('be.visible');
    cy.get('h2').should('contain', 'Load a local LLM model');
  });

  it('should switch between tabs', () => {
    // Wait for overlay to be visible and close it if possible or just check sidebar
    cy.get('.tab-btn').contains('Email').click();
    cy.get('app-email-tab').should('be.visible');

    cy.get('.tab-btn').contains('Todo').click();
    cy.get('app-todo-tab').should('be.visible');
  });
});
