// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @enterprise @onboarding

import * as TIMEOUTS from '../../fixtures/timeouts';
import {generateRandomUser} from '../../support/api/user';
import {
    getWelcomeEmailTemplate,
    reUrl,
    verifyEmailBody,
} from '../../utils';

describe('Onboarding', () => {
    let siteName;
    let siteUrl;
    let testTeam;
    const {username, email, password} = generateRandomUser();

    before(() => {
        // # Disable LDAP, require email invitation, and do email test if setup properly
        cy.apiUpdateConfig({
            LdapSettings: {Enable: false},
            EmailSettings: {RequireEmailVerification: true},
            ServiceSettings: {EnableOnboardingFlow: true},
        }).then(({config}) => {
            siteName = config.TeamSettings.SiteName;
            siteUrl = config.ServiceSettings.SiteURL;
        });
        cy.shouldHaveEmailEnabled();

        cy.apiInitSetup().then(({team}) => {
            testTeam = team;
            cy.visit(`/${testTeam.name}/channels/town-square`);
        });
    });

    it('MM-T400 Create account from login page link using email-password', () => {
        // # Open team menu and click on "Team Settings"
        cy.uiOpenTeamMenu('Team Settings');

        // * Check that the 'Team Settings' modal was opened
        cy.get('#teamSettingsModal').should('exist').within(() => {
            cy.get('#open_inviteEdit').should('be.visible').click();

            // # Enable any user with an account on the server to join the team
            cy.get('#teamOpenInvite').should('be.visible').click();
            cy.findByText('Save').should('be.visible').click();

            // # Close the modal
            cy.get('#teamSettingsModalLabel').find('button').should('be.visible').click();
        });

        // # Logout from sysadmin account
        cy.apiLogout();

        // # Visit the team url
        cy.visit(`/${testTeam.name}`);

        // # Attempt to create a new account
        cy.get('.login-body-card', {timeout: TIMEOUTS.ONE_MIN}).should('be.visible');
        cy.findByText('Create an account').should('be.visible').click();
        cy.get('#email').should('be.focused').and('be.visible').type(email);
        cy.get('#name').should('be.visible').type(username);
        cy.get('#password').should('be.visible').type(password);
        cy.get('#createAccountButton').should('be.visible').click();

        cy.findByText('Mattermost: You are almost done').should('be.visible');

        // # Get invitation email and go to the provided link
        getEmail(username, email);

        // * Ensure that the email was correctly verified
        cy.findByText('Email Verified').should('be.visible');

        // * Ensure that the email was pre-filled and the password input box is focused
        cy.get('#input_loginId').should('be.visible').and('have.value', email);
        cy.get('#input_password-input').should('be.visible').and('be.focused').type(password);

        // # Click on the login button
        cy.get('#saveSetting').click();

        // * Check that the display name of the team the user was invited to is being correctly displayed
        cy.uiGetLHSHeader().findByText(testTeam.display_name);

        // * Check that 'Town Square' is currently being selected
        cy.get('.active').within(() => {
            cy.get('#sidebarItem_town-square').should('exist');
        });

        // * Check that the 'Welcome to Mattermost' message is visible
        cy.findByText(`Welcome to ${siteName}`).should('be.visible');
    });

    // eslint-disable-next-line no-shadow
    function getEmail(username, email) {
        cy.getRecentEmail({username, email}).then((data) => {
            // * Verify that the email subject is correct
            expect(data.subject).to.equal(`[${siteName}] You joined ${siteUrl.split('/')[2]}`);

            // * Verify that the email body is correct
            const expectedEmailBody = getWelcomeEmailTemplate(email, siteName, testTeam.name);
            verifyEmailBody(expectedEmailBody, data.body);

            // # Visit permalink (e.g. click on email link)
            const permalink = data.body[4].match(reUrl)[0];
            cy.visit(permalink);
        });
    }
});
