import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

import { IconComponent } from '../../../../../../shared/components/icon/icon.component';
import { avatarPhotoUrl } from '../../../../../../shared/utils/unsplash';
import { PostComment } from '../../../../../../core/models/community.models';

@Component({
  selector: 'app-comment-section',
  imports: [IconComponent],
  templateUrl: './comment-section.component.html',
  styleUrl: './comment-section.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CommentSectionComponent {
  readonly postId = input.required<string>();
  readonly comments = input<PostComment[]>([]);
  readonly likedCommentIds = input<ReadonlySet<string>>(new Set());
  readonly draft = input('');
  readonly authorInitials = input('AV');

  readonly likeComment = output<string>();
  readonly reply = output<PostComment>();
  readonly draftChange = output<string>();
  readonly submit = output<void>();

  avatarFor(author: string): string {
    return avatarPhotoUrl(author, 64);
  }

  isLiked(commentId: string): boolean {
    return this.likedCommentIds().has(`${this.postId()}_${commentId}`);
  }
}
