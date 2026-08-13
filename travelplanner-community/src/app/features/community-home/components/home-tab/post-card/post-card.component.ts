import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

import { IconComponent } from '../../../../../shared/components/icon/icon.component';
import { CommentSectionComponent } from './comment-section/comment-section.component';
import { avatarPhotoUrl } from '../../../../../shared/utils/unsplash';
import { CommunityPost, PostComment } from '../../../../../core/models/community.models';

const MEETUP_FACE_GRADIENTS = ['linear-gradient(140deg,#F2B872,#D2604B)', 'linear-gradient(140deg,#0060EA,#2AA98B)', 'linear-gradient(140deg,#6B3FA0,#0060EA)'];

@Component({
  selector: 'app-post-card',
  imports: [IconComponent, CommentSectionComponent],
  templateUrl: './post-card.component.html',
  styleUrl: './post-card.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PostCardComponent {
  readonly post = input.required<CommunityPost>();
  readonly followed = input(false);
  readonly saved = input(false);
  readonly helpfulOn = input(false);
  readonly joined = input(false);
  readonly commentsOpen = input(false);
  readonly commentDraft = input('');
  readonly likedCommentIds = input<ReadonlySet<string>>(new Set());
  readonly votedOptionId = input<string | undefined>(undefined);
  readonly currentUserInitials = input('AV');
  readonly matchesTripPlace = input('Paris');

  readonly toggleFollow = output<void>();
  readonly deletePost = output<void>();
  readonly openOptions = output<void>();
  readonly toggleHelpful = output<void>();
  readonly toggleComments = output<void>();
  readonly toggleSave = output<void>();
  readonly share = output<void>();
  readonly runCta = output<void>();
  readonly votePoll = output<string>();
  readonly likeComment = output<string>();
  readonly replyToComment = output<PostComment>();
  readonly commentDraftChange = output<string>();
  readonly submitComment = output<void>();

  readonly meetupFaces = MEETUP_FACE_GRADIENTS;

  readonly avatar = computed(() => avatarPhotoUrl(this.post().author, 92));

  readonly relevantToTrip = computed(() => !this.post().authoredByMe && this.post().place === this.matchesTripPlace());

  readonly helpfulCount = computed(() => this.post().helpfulBase + (this.helpfulOn() ? 1 : 0));

  readonly ctaOn = computed(() => {
    const post = this.post();
    return (post.cta === 'join' && this.joined()) || (post.cta === 'save' && this.saved());
  });

  readonly ctaLabel = computed(() => {
    const post = this.post();
    if (post.cta === 'join' && this.joined()) {
      return '✓ Going';
    }
    if (post.cta === 'save' && this.saved()) {
      return '✓ Saved';
    }
    return post.ctaLabel;
  });

  pollPercent(optionId: string, basePercent: number): string {
    if (!this.votedOptionId()) {
      return '';
    }
    const bumped = basePercent + (this.votedOptionId() === optionId ? 1 : 0);
    return `${bumped}%`;
  }

  pollBarWidth(optionId: string, basePercent: number): string {
    return this.votedOptionId() ? `${basePercent + (this.votedOptionId() === optionId ? 1 : 0)}%` : '0%';
  }

  get pollMeta(): string {
    const post = this.post();
    const base = post.pollVotesBase ?? 0;
    const voted = this.votedOptionId();
    const total = base + (voted ? 1 : 0);
    const who = total === 0 ? 'No votes yet' : total === 1 ? '1 vote' : `${total.toLocaleString()} travelers voted`;
    return `${who}${voted ? ' · you voted' : ' · closes in 2 days'}`;
  }
}
