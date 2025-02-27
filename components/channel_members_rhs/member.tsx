// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import styled, {css} from 'styled-components';
import classNames from 'classnames';
import {FormattedMessage} from 'react-intl';

import {UserProfile} from '@mattermost/types/users';
import ProfilePicture from 'components/profile_picture';
import {Client4} from 'mattermost-redux/client';
import ChannelMembersDropdown from 'components/channel_members_dropdown';
import {Channel} from '@mattermost/types/channels';

import OverlayTrigger from 'components/overlay_trigger';
import Tooltip from 'components/tooltip';

import Constants from 'utils/constants';

import {isGuest} from 'mattermost-redux/utils/user_utils';
import GuestBadge from 'components/widgets/badges/guest_badge';

import {ChannelMember} from './channel_members_rhs';

const Avatar = styled.div`
    flex-basis: fit-content;
    flex-shrink: 0;
`;

const UserInfo = styled.div`
    flex: 1;
    overflow-x: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
`;

const DisplayName = styled.span`
    margin-left: 8px;
    font-size: 14px;
    line-height: 20px;
    color: var(--center-channel-color);
`;

const Username = styled.span`
    margin-left: 8px;
    font-size: 12px;
    line-height: 18px;
    color: rgba(var(--center-channel-color-rgb), 0.56);
`;

const SendMessage = styled.button`
    display: none;
    border: 0;
    background-color: transparent;
    padding: 0;
    width: 24px;
    height: 24px;
    border-radius: 4px;
    &:hover {
        background-color: rgba(var(--center-channel-color-rgb), 0.12);
    }
    .icon {
        font-size: 14.4px;
        color: rgba(var(--center-channel-color-rgb), 0.56);
    };
`;

const RoleChooser = styled.div`
    display: none;
    opacity: 0;
    flex-basis: fit-content;
    flex-shrink: 0;

    &.editing {
        display: block;
    }

    .MenuWrapper {
        padding: 6px 10px;
        border-radius: 4px;
        &.MenuWrapper--open {
            background: rgba(var(--button-bg-rgb), 0.16);
        }
        &:not(.MenuWrapper--open):hover {
            background: rgba(var(--center-channel-text-rgb), 0.08);
        }
    }
`;

interface Props {
    className?: string;
    channel: Channel;
    member: ChannelMember;
    index: number;
    totalUsers: number;
    editing: boolean;
    actions: {
        openDirectMessage: (user: UserProfile) => void;
    };
}

const Member = ({className, channel, member, index, totalUsers, editing, actions}: Props) => {
    return (
        <div
            className={className}
            data-testid={`memberline-${member.user.id}`}
        >
            <Avatar>
                <ProfilePicture
                    isRHS={true}
                    popoverPlacement='left'
                    size='sm'
                    status={member.status}
                    isBot={member.user.is_bot}
                    userId={member.user.id}
                    username={member.displayName}
                    src={Client4.getProfilePictureUrl(member.user.id, member.user.last_picture_update)}
                />
            </Avatar>
            <UserInfo>
                <DisplayName>
                    {member.displayName}
                    <GuestBadge show={isGuest(member.user.roles)}/>
                </DisplayName>
                <Username>{'@'}{member.user.username}</Username>
            </UserInfo>
            <RoleChooser
                className={classNames({editing}, 'member-role-chooser')}
                data-testid='rolechooser'
            >
                <ChannelMembersDropdown
                    channel={channel}
                    user={member.user}
                    channelMember={member.membership}
                    index={index}
                    totalUsers={totalUsers}
                    channelAdminLabel={
                        <FormattedMessage
                            id='channel_members_rhs.member.select_role_channel_admin'
                            defaultMessage='Admin'
                        />
                    }
                    channelMemberLabel={
                        <FormattedMessage
                            id='channel_members_rhs.member.select_role_channel_member'
                            defaultMessage='Member'
                        />
                    }
                    guestLabel={
                        <FormattedMessage
                            id='channel_members_rhs.member.select_role_guest'
                            defaultMessage='Guest'
                        />
                    }
                />
            </RoleChooser>
            {!editing && (
                <SendMessage onClick={() => actions.openDirectMessage(member.user)}>
                    <OverlayTrigger
                        delayShow={Constants.OVERLAY_TIME_DELAY}
                        placement='left'
                        overlay={
                            <Tooltip>
                                <FormattedMessage
                                    id='channel_members_rhs.member.send_message'
                                    defaultMessage='Send message'
                                />
                            </Tooltip>
                        }
                    >
                        <i className='icon icon-send'/>
                    </OverlayTrigger>
                </SendMessage>
            )}
        </div>
    );
};

export default styled(Member)`
    display: flex;
    flex-direction: row;
    align-items: center;
    padding: 8px 16px;
    border-radius: 4px;

    &:hover {
        background: rgba(var(--center-channel-text-rgb), 0.08);
        color: rgba(var(--center-channel-text-rgb), 0.56);
        ${() => {
        return css`
            ${SendMessage} {
                display: block;
            }
            `;
    }}
    }

    .MenuWrapper {
        font-weight: 600;
        font-size: 11px;
    }
`;
