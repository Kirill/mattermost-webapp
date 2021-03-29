// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {ActionCreatorsMapObject, bindActionCreators, Dispatch} from 'redux';
import {createSelector} from 'reselect';

import {getDataRetentionCustomPolicyTeams, searchDataRetentionCustomPolicyTeams} from 'mattermost-redux/actions/admin';
import {getTeamsInPolicy, searchTeamsInPolicy} from 'mattermost-redux/selectors/entities/teams';
import {getDataRetentionCustomPolicy} from 'mattermost-redux/selectors/entities/admin';
import {teamListToMap, filterTeamsStartingWithTerm} from 'mattermost-redux/utils/team_utils';

import {ActionFunc, ActionResult, GenericAction} from 'mattermost-redux/types/actions';

import {Team, TeamSearchOpts, TeamsWithCount} from 'mattermost-redux/types/teams';

import {GlobalState} from 'types/store';
import {setTeamListSearch} from 'actions/views/search';
import TeamList from './team_list';
import { Dictionary } from 'mattermost-redux/types/utilities';
import { DataRetentionCustomPolicy } from 'mattermost-redux/types/data_retention';

type OwnProps = {
    policyId?: string;
    teamsToAdd: Dictionary<Team>;
}

type Actions = {
    getDataRetentionCustomPolicyTeams: (id: string, page: number, perPage: number) => Promise<{ data: Team[] }>;
    searchDataRetentionCustomPolicyTeams: (id: string, term: string, opts: TeamSearchOpts) => Promise<{ data: Team[] }>;
    setTeamListSearch: (term: string) => ActionResult;
}

function searchTeamsToAdd(teams: Dictionary<Team>, term: string): Dictionary<Team> {
    const filteredTeams = filterTeamsStartingWithTerm(Object.keys(teams).map((key) => teams[key]), term);
    return teamListToMap(filteredTeams);
}

function mapStateToProps() {
    const getPolicyTeams = getTeamsInPolicy();
    return (state: GlobalState, ownProps: OwnProps) => {
        let {teamsToAdd} = ownProps;

        let teams: Team[] = [];
        const policyId = ownProps.policyId;
        const policy = policyId ? getDataRetentionCustomPolicy(state, policyId) || {} as DataRetentionCustomPolicy : {} as DataRetentionCustomPolicy;
        let totalCount = 0;
        let searchTerm = state.views.search.teamListSearch || '';
    
        if (searchTerm) {
            teams = searchTeamsInPolicy(state, searchTerm) || [];
            teamsToAdd = searchTeamsToAdd(teamsToAdd, searchTerm);
            totalCount = teams.length;
        } else {
            teams = policyId ? getPolicyTeams(state, {policyId}) : [];
            if (policy && policy.team_count) {
                totalCount = policy.team_count;
            }
        }
        
        return {
            teams,
            totalCount,
            searchTerm,
            teamsToAdd,
        };
    }
}

function mapDispatchToProps(dispatch: Dispatch) {
    return {
        actions: bindActionCreators<ActionCreatorsMapObject<ActionFunc | GenericAction>, Actions>({
            getDataRetentionCustomPolicyTeams,
            searchTeams: searchDataRetentionCustomPolicyTeams,
            setTeamListSearch
        }, dispatch),
    };
}

export default connect(mapStateToProps, mapDispatchToProps)(TeamList);
