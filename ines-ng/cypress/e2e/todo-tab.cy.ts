describe('Todo Tab — Voice Recording E2E', () => {
  beforeEach(() => {
    cy.visit('/', {
      onBeforeLoad(win) {
        class MockSpeechRecognition {
          continuous = false;
          interimResults = false;
          lang = '';
          onresult: ((event: any) => void) | null = null;
          onerror: ((event: any) => void) | null = null;
          onend: (() => void) | null = null;
          results: SpeechRecognitionResult[] = [];

          start() {}
          stop() {
            if (this.onend) this.onend();
          }
          abort() {}
        }

        Object.defineProperty(win, 'SpeechRecognition', {
          value: MockSpeechRecognition,
          writable: true,
        });
        Object.defineProperty(win, 'webkitSpeechRecognition', {
          value: MockSpeechRecognition,
          writable: true,
        });
        Object.defineProperty(win, 'speechSynthesis', {
          value: {
            speak() {},
            cancel() {},
            getVoices() {
              return [];
            },
          },
          writable: true,
        });
      },
    });

    cy.get('app-loader-overlay app-button button').first().click({ force: true });
    cy.get('#loader-overlay').should('not.exist');

    cy.get('.tab-btn').contains('Todo').click();
    cy.get('app-todo-tab').should('be.visible');
    cy.contains('Daily Planner').should('be.visible');
  });

  it('should display the AI Planner panel', () => {
    cy.get('app-todo-tab').within(() => {
      cy.contains('AI PLANNER').should('be.visible');
    });
  });

  it('should show empty state in AI chat when no messages', () => {
    cy.get('app-todo-tab').within(() => {
      cy.contains('Let AI plan your day').should('be.visible');
    });
  });

  it('should show Record button', () => {
    cy.get('app-todo-tab').within(() => {
      cy.contains('Record').should('be.visible');
    });
  });

  it('should show manual task input', () => {
    cy.get('app-todo-tab').within(() => {
      cy.get('input[placeholder="Add a task..."]').should('be.visible');
    });
  });

  it('should add a task manually and see it in the list', () => {
    cy.get('app-todo-tab').within(() => {
      cy.get('input[placeholder="Add a task..."]').type('Buy groceries{enter}');
      cy.contains('Buy groceries').should('be.visible');
    });
  });

  it('should show category selector with all options', () => {
    cy.get('app-todo-tab').within(() => {
      cy.get('select').first().find('option').should('have.length', 4);
      cy.get('select').first().find('option').first().should('contain', 'Work');
      cy.get('select').first().find('option').eq(1).should('contain', 'Personal');
      cy.get('select').first().find('option').eq(2).should('contain', 'Health');
      cy.get('select').first().find('option').eq(3).should('contain', 'Other');
    });
  });

  it('should show priority selector with Normal and High', () => {
    cy.get('app-todo-tab').within(() => {
      cy.get('select').last().find('option').should('have.length', 2);
      cy.get('select').last().find('option').first().should('contain', 'Normal');
      cy.get('select').last().find('option').eq(1).should('contain', 'High');
    });
  });

  it('should toggle task completion', () => {
    cy.get('app-todo-tab').within(() => {
      cy.get('input[placeholder="Add a task..."]').type('Test task{enter}');
      cy.contains('Test task').should('be.visible');
      cy.contains('Test task').parents('.todo-item').find('[title="Toggle done"]').click();
      cy.contains('Test task').parents('.todo-item').should('have.class', 'done');
    });
  });

  it('should show filter tabs All, Active, Done', () => {
    cy.get('app-todo-tab').within(() => {
      cy.contains('All').should('be.visible');
      cy.contains('Active').should('be.visible');
      cy.contains('Done').should('be.visible');
    });
  });

  it('should filter to Active only', () => {
    cy.get('app-todo-tab').within(() => {
      cy.get('input[placeholder="Add a task..."]').type('Active task{enter}');
      cy.contains('Active').click();
      cy.contains('Active task').should('be.visible');
      cy.contains('Active task').parents('.todo-item').find('[title="Toggle done"]').click();
      cy.contains('Active task').should('not.exist');
    });
  });

  it('should filter to Done only', () => {
    cy.get('app-todo-tab').within(() => {
      cy.get('input[placeholder="Add a task..."]').type('Done task{enter}');
      cy.contains('Done task').parents('.todo-item').find('[title="Toggle done"]').click();
      cy.contains('Done').click();
      cy.contains('Done task').should('be.visible');
    });
  });

  it('should show progress bar after adding tasks', () => {
    cy.get('app-todo-tab').within(() => {
      cy.get('input[placeholder="Add a task..."]').type('Task 1{enter}');
      cy.get('input[placeholder="Add a task..."]').type('Task 2{enter}');
      cy.contains('Progress').should('be.visible');
      cy.contains('0/2').should('be.visible');
    });
  });

  it('should show category badge on task', () => {
    cy.get('app-todo-tab').within(() => {
      cy.get('input[placeholder="Add a task..."]').type('Work task{enter}');
      cy.contains('Work').should('exist');
    });
  });

  it('should show High priority badge on priority task', () => {
    cy.get('app-todo-tab').within(() => {
      cy.get('select').last().select('High');
      cy.get('input[placeholder="Add a task..."]').type('Urgent task{enter}');
      cy.contains('High').should('exist');
    });
  });

  it('should show due date on task', () => {
    cy.get('app-todo-tab').within(() => {
      cy.get('input[type="date"]').type('2026-12-31');
      cy.get('input[placeholder="Add a task..."]').type('Future task{enter}');
      cy.contains('Dec 31').should('be.visible');
    });
  });

  it('should start recording when clicking Record button', () => {
    cy.get('app-todo-tab').within(() => {
      cy.contains('Record').click();
      cy.contains('Stop').should('be.visible');
    });
  });

  it('should show undo button after adding a task', () => {
    cy.get('app-todo-tab').within(() => {
      cy.get('input[placeholder="Add a task..."]').type('Undo test{enter}');
      cy.contains('Undo').should('be.visible');
    });
  });

  it('should show clear done button', () => {
    cy.get('app-todo-tab').within(() => {
      cy.contains('All').click();
      cy.get('input[placeholder="Add a task..."]').type('To clear{enter}');
      cy.contains('To clear')
        .parents('.todo-item')
        .find('[title="Toggle done"]')
        .first()
        .click({ force: true });
      cy.contains('Clear done').should('be.visible');
    });
  });

  it('should double-click task to edit inline', () => {
    cy.get('app-todo-tab').within(() => {
      cy.get('input[placeholder="Add a task..."]').type('Editable task{enter}');
      cy.contains('Editable task').dblclick();
      cy.get('input').should('be.visible');
    });
  });

  it('should show remaining count', () => {
    cy.get('app-todo-tab').within(() => {
      cy.get('input[placeholder="Add a task..."]').type('Remaining 1{enter}');
      cy.get('input[placeholder="Add a task..."]').type('Remaining 2{enter}');
      cy.contains('2 remaining').should('be.visible');
    });
  });
});
