describe('Learning Tab E2E', () => {
  beforeEach(() => {
    cy.visit('/');

    cy.get('app-loader-overlay app-button button').first().click({ force: true });
    cy.get('#loader-overlay').should('not.exist');

    cy.get('.tab-btn').contains('Learning').click();
    cy.get('app-learning-tab').should('be.visible');
  });

  // ── Layout & Initial State ──

  it('should display the panel header with title', () => {
    cy.get('app-learning-tab').within(() => {
      cy.contains('Learning Center').should('be.visible');
      cy.contains('RAG-powered analysis').should('be.visible');
    });
  });

  it('should show upload area', () => {
    cy.get('app-learning-tab').within(() => {
      cy.get('input[type="file"]').should('exist');
      cy.contains('add_circle_outline').should('exist');
    });
  });

  it('should show doc/chunk count starting at zero', () => {
    cy.get('app-learning-tab').within(() => {
      cy.contains('0 docs').should('be.visible');
    });
  });

  it('should show empty documents message initially', () => {
    cy.get('app-learning-tab').within(() => {
      cy.contains('No documents yet').should('be.visible');
    });
  });

  it('should show search input for filtering docs', () => {
    cy.get('app-learning-tab').within(() => {
      cy.get('input[placeholder="Filter docs..."]').should('be.visible');
    });
  });

  it('should show Learning Tools section', () => {
    cy.get('app-learning-tab').within(() => {
      cy.contains('Learning Tools').should('be.visible');
      cy.contains('Chat Q&A').should('be.visible');
    });
  });

  it('should show Clear button in header', () => {
    cy.get('app-learning-tab').within(() => {
      cy.contains('Clear').should('be.visible');
    });
  });

  // ── Document Upload ──

  it('should upload a Markdown file and show it in the document list', () => {
    cy.get('app-learning-tab').within(() => {
      cy.get('input[type="file"]').selectFile('cypress/fixtures/test-document.md', {
        force: true,
      });
      cy.contains('test-document.md', { timeout: 10000 }).should('be.visible');
      cy.contains('1 docs', { timeout: 10000 }).should('be.visible');
    });
  });

  it('should show chunk count after uploading', () => {
    cy.get('app-learning-tab').within(() => {
      cy.get('input[type="file"]').selectFile('cypress/fixtures/test-document.md', {
        force: true,
      });
      cy.get('span')
        .contains(/^\d+ chunks$/, { timeout: 15000 })
        .should('be.visible');
    });
  });

  // ── Document Management ──

  it('should delete a document when clicking X button', () => {
    cy.get('app-learning-tab').within(() => {
      cy.get('input[type="file"]').selectFile('cypress/fixtures/test-document.md', {
        force: true,
      });
      cy.contains('test-document.md', { timeout: 10000 }).should('be.visible');
      cy.contains('test-document.md')
        .parent()
        .find('button > mat-icon')
        .contains('close')
        .click({ force: true });
      cy.contains('No documents yet', { timeout: 10000 }).should('be.visible');
    });
  });

  it('should clear all documents and reset state', () => {
    cy.get('app-learning-tab').within(() => {
      cy.get('input[type="file"]').selectFile('cypress/fixtures/test-document.md', {
        force: true,
      });
      cy.contains('test-document.md', { timeout: 10000 }).should('be.visible');
      cy.contains('Clear').click();
    });
    cy.get('app-confirm-dialog').should('be.visible');
    cy.get('app-confirm-dialog').contains('Clear All').click();
    cy.get('app-learning-tab').within(() => {
      cy.contains('No documents yet', { timeout: 10000 }).should('be.visible');
    });
  });

  // ── Doc Filtering ──

  it('should filter documents by search query', () => {
    cy.get('app-learning-tab').within(() => {
      cy.get('input[type="file"]').selectFile('cypress/fixtures/test-document.md', {
        force: true,
      });
      cy.contains('test-document.md', { timeout: 10000 }).should('be.visible');
      cy.get('input[placeholder="Filter docs..."]').type('nonexistent');
      cy.contains('test-document.md').should('not.exist');
    });
  });

  it('should show document again after clearing search filter', () => {
    cy.get('app-learning-tab').within(() => {
      cy.get('input[type="file"]').selectFile('cypress/fixtures/test-document.md', {
        force: true,
      });
      cy.contains('test-document.md', { timeout: 10000 }).should('be.visible');
      cy.get('input[placeholder="Filter docs..."]').type('zzz');
      cy.contains('test-document.md').should('not.exist');
      cy.get('input[placeholder="Filter docs..."]').clear();
      cy.contains('test-document.md').should('be.visible');
    });
  });

  // ── Collapsible Sidebar ──

  it('should collapse and expand the Documents section', () => {
    cy.get('app-learning-tab').within(() => {
      cy.contains('Documents').should('be.visible');
      cy.get('input[placeholder="Filter docs..."]').should('be.visible');
      cy.contains('Documents').click();
      cy.get('input[placeholder="Filter docs..."]').should('not.exist');
      cy.contains('Documents').click();
      cy.get('input[placeholder="Filter docs..."]').should('be.visible');
    });
  });

  it('should collapse and expand the Learning Tools section', () => {
    cy.get('app-learning-tab').within(() => {
      cy.contains('Chat Q&A').should('be.visible');
      cy.contains('Learning Tools').click();
      cy.contains('Chat Q&A').should('not.exist');
      cy.contains('Learning Tools').click();
      cy.contains('Chat Q&A').should('be.visible');
    });
  });

  // ── Sub-tab: Chat Q&A ──

  it('should show empty state in Chat when no messages', () => {
    cy.get('app-learning-tab').within(() => {
      cy.contains('Ask your learning materials').should('be.visible');
    });
  });

  it('should show disabled send button when no input', () => {
    cy.get('app-learning-tab').within(() => {
      cy.get('textarea.input-field').should('be.visible');
      cy.get('.send-btn').should('be.disabled');
    });
  });

  it('should have a textarea for user input', () => {
    cy.get('app-learning-tab').within(() => {
      cy.get('textarea')
        .filter('[placeholder="Ask about your study materials..."]')
        .should('be.visible');
    });
  });

  // ── Sub-tab: Mind Map ──

  it('should navigate to Mind Map sub-tab', () => {
    cy.get('app-learning-tab').within(() => {
      cy.get('button').contains('Mind Map').click({ force: true });
      cy.wait(300);
      cy.get('.mermaid-container').should('exist');
    });
  });

  it('should show zoom controls in Mind Map', () => {
    cy.get('app-learning-tab').within(() => {
      cy.get('button').contains('Mind Map').click({ force: true });
      cy.wait(300);
      cy.contains('center_focus_strong').should('exist');
    });
  });

  // ── Sub-tab: Quiz ──

  it('should navigate to Quiz sub-tab', () => {
    cy.get('app-learning-tab').within(() => {
      cy.get('button').contains('Quiz').click({ force: true });
      cy.wait(300);
      cy.contains('Test Your Knowledge').should('be.visible');
    });
  });

  it('should show quiz configuration controls', () => {
    cy.get('app-learning-tab').within(() => {
      cy.get('button').contains('Quiz').click({ force: true });
      cy.wait(300);
      cy.contains('Questions:').should('be.visible');
      cy.contains('Timer (min):').should('be.visible');
    });
  });

  // ── Sub-tab: Flashcards ──

  it('should navigate to Flashcards sub-tab', () => {
    cy.get('app-learning-tab').within(() => {
      cy.get('button').contains('Flashcards').click({ force: true });
    });
    cy.get('app-learning-tab').within(() => {
      cy.contains('Generate Anki-compatible flashcards').should('be.visible');
    });
  });

  // ── Sub-tab: Study Plan ──

  it('should navigate to Study Plan sub-tab', () => {
    cy.get('app-learning-tab').within(() => {
      cy.get('button').contains('Study Plan').click({ force: true });
    });
    cy.get('app-learning-tab').within(() => {
      cy.contains('Generate a structured study plan').should('be.visible');
      cy.contains('Generate Plan').should('be.visible');
    });
  });

  // ── Sub-tab: Summary ──

  it('should navigate to Summary sub-tab', () => {
    cy.get('app-learning-tab').within(() => {
      cy.get('button').contains('Summary').click({ force: true });
    });
    cy.get('app-learning-tab').within(() => {
      cy.contains('Document Summary').should('be.visible');
      cy.contains('Generate Summary').should('be.visible');
    });
  });

  // ── Sub-tab: Fill Blanks ──

  it('should navigate to Fill Blanks sub-tab', () => {
    cy.get('app-learning-tab').within(() => {
      cy.get('button').contains('Fill Blanks').click({ force: true });
    });
    cy.get('app-learning-tab').within(() => {
      cy.contains('Practice key concepts with cloze exercises').should('be.visible');
      cy.contains('Generate Exercises').should('be.visible');
    });
  });

  // ── Sub-tab: Matching ──

  it('should navigate to Matching sub-tab', () => {
    cy.get('app-learning-tab').within(() => {
      cy.get('button').contains('Matching').click({ force: true });
    });
    cy.get('app-learning-tab').within(() => {
      cy.contains('Match terms with their correct definitions').should('be.visible');
      cy.contains('Generate Pairs').should('be.visible');
    });
  });

  // ── Sub-tab: Open Q&A ──

  it('should navigate to Open Q&A sub-tab', () => {
    cy.get('app-learning-tab').within(() => {
      cy.get('button').contains('Open Q&A').click({ force: true });
    });
    cy.get('app-learning-tab').within(() => {
      cy.contains('Open-Ended Question').should('be.visible');
      cy.contains('Generate Question').should('be.visible');
    });
  });

  // ── Rapid Sub-tab Switching ──

  it('should support rapid switching between 6 sub-tabs', () => {
    cy.get('app-learning-tab').within(() => {
      const tabs = ['Chat Q&A', 'Mind Map', 'Quiz', 'Flashcards', 'Study Plan', 'Summary'];
      tabs.forEach((tab) => {
        cy.get('button').contains(tab).click({ force: true });
        cy.wait(100);
      });
    });
  });

  it('should switch between all 9 sub-tabs', () => {
    cy.get('app-learning-tab').within(() => {
      const tabs = [
        'Chat Q&A',
        'Mind Map',
        'Quiz',
        'Flashcards',
        'Study Plan',
        'Summary',
        'Fill Blanks',
        'Matching',
        'Open Q&A',
      ];
      tabs.forEach((tab) => {
        cy.get('button').contains(tab).click({ force: true });
        cy.wait(50);
      });
    });
  });

  // ── Active Sub-tab Highlighting ──

  it('should highlight the active sub-tab in the sidebar nav', () => {
    cy.get('app-learning-tab').within(() => {
      cy.get('button').contains('Study Plan').click({ force: true });
      cy.get('button.bg-white\\/8').should('exist');
    });
  });

  // ── File Type: TXT ──

  it('should upload a TXT file', () => {
    cy.writeFile('cypress/downloads/test-upload.txt', 'This is a test text file for learning.');
    cy.get('app-learning-tab').within(() => {
      cy.get('input[type="file"]').selectFile('cypress/downloads/test-upload.txt', {
        force: true,
      });
      cy.contains('test-upload.txt', { timeout: 10000 }).should('be.visible');
    });
  });
});
