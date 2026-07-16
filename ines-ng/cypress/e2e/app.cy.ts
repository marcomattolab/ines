describe('INES Application E2E', () => {
  beforeEach(() => {
    cy.visit('/');

    // Dismiss the loader overlay
    cy.get('app-loader-overlay app-button button').first().click({ force: true });
    cy.get('#loader-overlay').should('not.exist');
  });

  // ── Core Navigation ──

  it('should display the status bar with model info', () => {
    cy.get('app-status-bar').should('be.visible');
    cy.get('app-status-bar').contains('No model loaded').should('be.visible');
  });

  it('should show the footer with copyright', () => {
    cy.get('#app-footer').should('be.visible');
    cy.get('#app-footer').contains('INES').should('be.visible');
  });

  it('should show the Chat tab by default', () => {
    cy.get('app-chat-tab').should('be.visible');
    cy.contains('Ines (General Assistant)').should('be.visible');
  });

  it('should have all 12 sidebar tab buttons', () => {
    cy.get('.tab-btn').should('have.length', 12);
  });

  it('should show sidebar divider categories', () => {
    cy.get('#sidebar').scrollTo('bottom');
    cy.get('.sidebar-header').should('have.length.at.least', 1);
  });

  it('should highlight active tab in sidebar', () => {
    cy.get('.tab-btn.active').contains('Chat').should('be.visible');
    cy.get('.tab-btn').contains('Todo').click();
    cy.get('.tab-btn.active').contains('Todo').should('be.visible');
    cy.get('.tab-btn.active').should('have.length', 1);
  });

  // ── Tab Switching ──

  it('should switch to Email tab', () => {
    cy.get('.tab-btn').contains('Email').click();
    cy.get('app-email-tab').should('be.visible');
    cy.contains('Email Assistant').should('be.visible');
  });

  it('should switch to Meeting tab', () => {
    cy.get('.tab-btn').contains('Meeting').click();
    cy.get('app-meeting-tab').should('be.visible');
    cy.contains('Meeting Recorder').should('be.visible');
  });

  it('should switch to Translate tab', () => {
    cy.get('.tab-btn').contains('Translate').click();
    cy.get('app-translate-tab').should('be.visible');
    cy.contains('Translator').should('be.visible');
  });

  it('should switch to Todo tab', () => {
    cy.get('.tab-btn').contains('Todo').click();
    cy.get('app-todo-tab').should('be.visible');
    cy.contains('Daily Planner').should('be.visible');
  });

  it('should switch to Code tab', () => {
    cy.get('.tab-btn').contains('Code').click();
    cy.get('app-coding-tab').should('be.visible');
    cy.contains('Angular + TypeScript Assistant').should('be.visible');
  });

  it('should show Coding tab suggestion chips', () => {
    cy.get('.tab-btn').contains('Code').click();
    cy.get('app-coding-tab').within(() => {
      cy.get('.suggestion-chip').should('have.length.at.least', 3);
    });
  });

  it('should switch to Vision tab', () => {
    cy.get('.tab-btn').contains('Vision').click();
    cy.get('app-vision-tab').should('be.visible');
    cy.contains('Vision Assistant').should('be.visible');
  });

  it('should switch to Learning tab', () => {
    cy.get('.tab-btn').contains('Learning').click();
    cy.get('app-learning-tab').should('be.visible');
    cy.contains('Learning Center').should('be.visible');
  });

  it('should switch to Slides tab', () => {
    cy.get('.tab-btn').contains('Slides').click();
    cy.get('app-presentation-tab').should('be.visible');
    cy.contains('Presentation Generator').should('be.visible');
  });

  it('should show presentation branding controls', () => {
    cy.get('.tab-btn').contains('Slides').click();
    cy.get('app-presentation-tab').within(() => {
      cy.contains('Branding & Colors').should('be.visible');
      cy.contains('Generate Presentation').should('be.visible');
      cy.contains('Slides').should('be.visible');
    });
  });

  it('should switch to Knowledge tab', () => {
    cy.get('.tab-btn').contains('Knowledge').click();
    cy.get('app-knowledge-manager-tab').should('be.visible');
    cy.contains('Knowledge Base').should('be.visible');
  });

  // ── Project Tab ──

  it('should navigate to Project tab', () => {
    cy.get('.tab-btn').contains('Project').click();
    cy.get('app-project-tab').should('be.visible');
  });

  it('should show Project sidebar header and empty state', () => {
    cy.get('.tab-btn').contains('Project').click();
    cy.get('app-project-tab').within(() => {
      cy.contains('Project Memory').should('be.visible');
      cy.contains('No project docs yet').should('be.visible');
    });
  });

  it('should show Input and Output sub-tabs in Project', () => {
    cy.get('.tab-btn').contains('Project').click();
    cy.get('app-project-tab').within(() => {
      cy.contains('Input').should('be.visible');
      cy.contains('Output').should('be.visible');
    });
  });

  it('should default to Input sub-tab showing upload prompt', () => {
    cy.get('.tab-btn').contains('Project').click();
    cy.get('app-project-tab').within(() => {
      cy.contains('Add project context').should('be.visible');
    });
  });

  it('should switch to Output sub-tab and show chat prompt', () => {
    cy.get('.tab-btn').contains('Project').click();
    cy.get('app-project-tab').within(() => {
      cy.contains('Output').click();
      cy.contains('Ask about your project').should('be.visible');
    });
  });

  it('should show search input in Project sidebar', () => {
    cy.get('.tab-btn').contains('Project').click();
    cy.get('app-project-tab').within(() => {
      cy.get('input[placeholder="Search documents..."]').should('be.visible');
    });
  });

  it('should show upload zone exists in Project sidebar', () => {
    cy.get('.tab-btn').contains('Project').click();
    cy.get('app-project-tab').within(() => {
      cy.contains('Upload PDF, HTML, TXT, MD').should('exist');
    });
  });

  it('should show import button exists in Project sidebar', () => {
    cy.get('.tab-btn').contains('Project').click();
    cy.get('app-project-tab').within(() => {
      cy.contains('Import .ines-project').should('exist');
    });
  });

  it('should show export and clear buttons disabled when no docs', () => {
    cy.get('.tab-btn').contains('Project').click();
    cy.get('app-project-tab').within(() => {
      cy.get('button[title="Export project"]').should('be.disabled');
      cy.get('button[title="Clear all documents"]').should('be.disabled');
    });
  });

  // ── Agents & Modals ──

  it('should switch to Agents tab', () => {
    cy.get('.tab-btn').contains('Agents').click();
    cy.get('app-agents-tab').should('be.visible');
  });

  it('should open info modal', () => {
    // The info button is the second app-button in the status bar, wrapping a button
    cy.get('app-status-bar').within(() => {
      cy.get('app-button')
        .last()
        .within(() => {
          cy.get('button').click({ force: true });
        });
    });
    cy.get('app-info-modal', { timeout: 5000 }).should('be.visible');
  });

  // ── Cross-tab navigation ──

  it('should support rapid tab switching', () => {
    cy.get('.tab-btn').contains('Project').click();
    cy.get('app-project-tab').should('be.visible');

    cy.get('.tab-btn').contains('Code').click();
    cy.get('app-coding-tab').should('be.visible');

    cy.get('.tab-btn').contains('Chat').click();
    cy.get('app-chat-tab').should('be.visible');
  });
});
