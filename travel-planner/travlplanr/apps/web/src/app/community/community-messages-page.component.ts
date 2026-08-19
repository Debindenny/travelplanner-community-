import { Component, OnInit, OnDestroy, inject, signal, ViewChild, ElementRef, AfterViewChecked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { CommunityMessagesService, Conversation, DirectMessage } from './services/community-messages.service';
import { CommunityProfileService, User } from './services/community-profile.service';
import { AuthService } from '../auth/auth.service';
import { ToastService } from '../shared/utils/toast.service';
import { WebsocketService } from '../core/services/websocket.service';
import { Subscription } from 'rxjs';
import { apiErrorMessage } from '../shared/utils/api-error.util';

@Component({
    selector: 'app-community-messages-page',
    imports: [CommonModule, FormsModule, TranslatePipe],
    template: `
    <div class="min-h-screen bg-gray-50 flex flex-col">
      <div class="flex-1 max-w-6xl w-full mx-auto flex h-[calc(100vh-68px)] p-4 gap-4">
    
        <!-- Conversations List -->
        <div class="w-1/3 bg-white border border-gray-200 rounded-xl flex flex-col overflow-hidden shadow-sm" [class.hidden]="(activeConversation() || pendingRecipient()) && isMobile()">
          <div class="p-4 border-b border-gray-200 flex items-center justify-between">
            <h2 class="text-xl font-bold text-gray-900">{{ 'COMMUNITY.MESSAGES.TITLE' | translate }}</h2>
            <button class="text-blue-600 hover:text-blue-700" [attr.aria-label]="'COMMUNITY.MESSAGES.NEW_MESSAGE_ARIA' | translate" (click)="openNewMessageModal()">
              <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </button>
          </div>
    
          <div class="flex-1 overflow-y-auto">
            @if (conversations().length === 0) {
              <div class="p-8 text-center text-gray-500">
                {{ 'COMMUNITY.MESSAGES.EMPTY_STATE' | translate }}
              </div>
            }
            @for (conv of conversations(); track conv.id) {
              <div
                class="flex items-center gap-3 p-4 border-b border-gray-100 cursor-pointer hover:bg-gray-50 transition-colors"
                [class.bg-blue-50]="activeConversation()?.id === conv.id"
                (click)="selectConversation(conv)"
                >
                <img
                  [src]="conv.other_user.avatar || '/assets/images/default-avatar.svg'"
                  class="w-12 h-12 rounded-full object-cover shrink-0"
                  loading="lazy"
                  decoding="async"
                  />
                <div class="flex-1 min-w-0">
                  <div class="flex justify-between items-baseline gap-2">
                    <h3 class="font-bold text-sm text-gray-900 truncate">{{ conv.other_user.name }}</h3>
                    <span class="text-xs text-gray-400 shrink-0">{{ conv.last_message_at | date:'shortTime' }}</span>
                  </div>
                  <p class="text-sm text-gray-500 truncate" [class.font-medium]="conv.unread_count > 0" [class.text-gray-900]="conv.unread_count > 0">
                    {{ conv.last_message_preview || ('COMMUNITY.MESSAGES.TAP_TO_VIEW' | translate) }}
                  </p>
                </div>
                @if (conv.unread_count > 0) {
                  <div class="w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center text-white text-xs font-bold shrink-0">
                    {{ conv.unread_count }}
                  </div>
                }
              </div>
            }
          </div>
        </div>
    
        <!-- Chat Area -->
        <div class="flex-1 bg-white border border-gray-200 rounded-xl flex flex-col shadow-sm" [class.hidden]="!activeConversation() && !pendingRecipient() && isMobile()">
          @if (!activeConversation() && !pendingRecipient()) {
            <div class="flex-1 flex flex-col items-center justify-center text-gray-500">
              <svg class="w-16 h-16 text-gray-300 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              <p class="text-lg">{{ 'COMMUNITY.MESSAGES.SELECT_PROMPT' | translate }}</p>
            </div>
          } @else {
            <!-- Chat Header -->
            <div class="p-4 border-b border-gray-200 flex items-center gap-3">
              <button class="md:hidden text-gray-600 mr-2" (click)="closeChat()" [attr.aria-label]="'COMMUNITY.MESSAGES.BACK_ARIA' | translate">
                <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" /></svg>
              </button>
              <img
                [src]="(activeConversation()?.other_user?.avatar || pendingRecipient()?.avatar) || '/assets/images/default-avatar.svg'"
                class="w-10 h-10 rounded-full object-cover"
                />
              <div class="flex-1">
                <h3 class="font-bold text-gray-900">{{ activeConversation()?.other_user?.name || pendingRecipient()?.name }}</h3>
                @if (activeConversation()) {
                  <p class="text-xs text-gray-400">{{ activeConversation()?.last_message_at | date:'shortTime' }}</p>
                } @else {
                  <p class="text-xs text-gray-400">{{ 'COMMUNITY.MESSAGES.NEW_CONVERSATION' | translate }}</p>
                }
              </div>
            </div>
    
            <!-- Chat Messages -->
            <div #messagesContainer class="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50 flex flex-col">
              @for (msg of messages(); track msg.id) {
                <div
                  class="flex flex-col max-w-[70%] rounded-2xl px-4 py-2 text-sm shadow-sm"
                  [class.self-end]="isMyMessage(msg)"
                  [class.bg-blue-600]="isMyMessage(msg)"
                  [class.text-white]="isMyMessage(msg)"
                  [class.self-start]="!isMyMessage(msg)"
                  [class.bg-white]="!isMyMessage(msg)"
                  [class.text-gray-900]="!isMyMessage(msg)"
                  [class.border]="!isMyMessage(msg)"
                  [class.border-gray-200]="!isMyMessage(msg)"
                  >
                  <p class="whitespace-pre-wrap">{{ msg.content }}</p>
                  <div class="flex items-center justify-end gap-1 mt-1 opacity-70">
                    <span class="text-2xs">{{ msg.created_at | date:'shortTime' }}</span>
                    @if (isMyMessage(msg)) {
                      <svg class="w-3 h-3" [class.text-blue-200]="msg.is_read" [class.text-white]="!msg.is_read" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        @if (msg.is_read) {
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7M2 13l4 4L12 11" />
                        }
                        @if (!msg.is_read) {
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                        }
                      </svg>
                    }
                  </div>
                </div>
              }
            </div>
    
            <!-- Input Area -->
            <div class="p-4 border-t border-gray-200">
              <div class="flex items-end gap-2 bg-gray-50 rounded-2xl p-2 border border-gray-200 focus-within:border-blue-500 focus-within:bg-white transition-colors">
                <textarea
                  [(ngModel)]="newMessage"
                  rows="1"
                  [placeholder]="'COMMUNITY.MESSAGES.INPUT_PLACEHOLDER' | translate"
                  class="flex-1 bg-transparent border-none focus:ring-0 resize-none py-2 px-3 outline-none"
                  (keydown.enter)="onMessageEnter($event)"
                ></textarea>
                <button
                  (click)="sendMessage()"
                  [disabled]="!newMessage.trim()"
                  class="p-2 text-blue-500 hover:text-blue-700 disabled:opacity-50 disabled:cursor-not-allowed mb-1"
                  >
                  <svg class="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
                </button>
              </div>
            </div>
          }
        </div>
    
      </div>
    </div>
    
    @if (showNewMessageModal()) {
      <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" (click)="showNewMessageModal.set(false)">
        <div class="w-full max-w-sm rounded-2xl bg-white shadow-xl max-h-[70vh] flex flex-col overflow-hidden" (click)="$event.stopPropagation()">
          <div class="p-4 border-b border-gray-200 flex items-center justify-between">
            <h3 class="text-lg font-bold text-gray-900">{{ 'COMMUNITY.MESSAGES.NEW_MESSAGE_TITLE' | translate }}</h3>
            <button class="text-gray-400 hover:text-gray-600" (click)="showNewMessageModal.set(false)" aria-label="Close">&times;</button>
          </div>
          <div class="p-3 border-b border-gray-200">
            <input
              type="text"
              class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              [placeholder]="'COMMUNITY.MESSAGES.SEARCH_PLACEHOLDER' | translate"
              [value]="pickerQuery()"
              (input)="onPickerQueryInput($any($event.target).value)"
              />
          </div>
          <div class="flex-1 overflow-y-auto">
            @if (pickerLoading()) {
              <div class="p-8 text-center text-gray-500">{{ 'COMMUNITY.MESSAGES.LOADING' | translate }}</div>
            } @else if (pickerUsers().length === 0) {
              <div class="p-8 text-center text-gray-500">{{ pickerQuery() ? ('COMMUNITY.MESSAGES.NO_SEARCH_RESULTS' | translate) : ('COMMUNITY.MESSAGES.NO_FOLLOWING' | translate) }}</div>
            } @else {
              @for (u of pickerUsers(); track u.id) {
                <button
                  type="button"
                  class="w-full flex items-center gap-3 p-3 hover:bg-gray-50 transition-colors text-left"
                  (click)="selectRecipient(u)"
                  >
                  <img [src]="u.avatar || '/assets/images/default-avatar.svg'" class="w-10 h-10 rounded-full object-cover shrink-0" loading="lazy" decoding="async" />
                  <span class="font-medium text-gray-900 truncate">{{ u.name }}</span>
                </button>
              }
            }
          </div>
        </div>
      </div>
    }
    `
})
export class CommunityMessagesPageComponent implements OnInit, OnDestroy, AfterViewChecked {
  @ViewChild('messagesContainer') private messagesContainer!: ElementRef;
  private messagesService = inject(CommunityMessagesService);
  private profileService = inject(CommunityProfileService);
  private auth = inject(AuthService);
  private toast = inject(ToastService);
  private wsService = inject(WebsocketService);
  private translate = inject(TranslateService);

  conversations = signal<Conversation[]>([]);
  activeConversation = signal<Conversation | null>(null);
  messages = signal<DirectMessage[]>([]);
  newMessage = '';
  private wsSubscription: Subscription | null = null;

  /** Set when composing a message to someone with no existing conversation yet. */
  pendingRecipient = signal<User | null>(null);
  showNewMessageModal = signal(false);
  pickerUsers = signal<User[]>([]);
  pickerLoading = signal(false);
  pickerQuery = signal('');
  private pickerSearchDebounce: ReturnType<typeof setTimeout> | null = null;

  ngOnInit() {
    this.loadConversations();
    this.subscribeToDirectMessages();
  }

  ngOnDestroy() {
    this.wsSubscription?.unsubscribe();
    if (this.pickerSearchDebounce) clearTimeout(this.pickerSearchDebounce);
  }

  private subscribeToDirectMessages() {
    this.wsSubscription = this.wsService.getMessages().subscribe((msg) => {
      if (msg.type === 'direct_message') {
        const payload = msg.payload as DirectMessage;
        const active = this.activeConversation();
        
        if (active && payload.conversation_id === active.id) {
          this.messages.update(list => [...list, payload]);
          this.scrollToBottom();
        }
        
        this.conversations.update(list => {
          const index = list.findIndex(c => c.id === payload.conversation_id);
          if (index !== -1) {
            const updatedList = [...list];
            const oldConv = updatedList[index];
            const isCurrentlyActive = active && oldConv.id === active.id;
            updatedList[index] = {
              ...oldConv,
              last_message_at: payload.created_at,
              unread_count: isCurrentlyActive ? 0 : oldConv.unread_count + 1
            };
            return updatedList.sort((a, b) => new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime());
          } else {
            this.loadConversations();
            return list;
          }
        });
      }
    });
  }

  isMobile(): boolean {
    return window.innerWidth < 768; // simple mobile check for responsive UI
  }

  isMyMessage(msg: DirectMessage): boolean {
    const user = this.auth.user();
    return msg.sender_id === user?.id;
  }

  loadConversations() {
    this.messagesService.getConversations().subscribe({
      next: (res) => this.conversations.set(res),
      error: () => {
        this.conversations.set([]);
      }
    });
  }

  selectConversation(conv: Conversation) {
    this.pendingRecipient.set(null);
    this.activeConversation.set(conv);
    // Mark as read locally immediately for UI snappiness
    this.conversations.update(list => list.map(c => c.id === conv.id ? { ...c, unread_count: 0 } : c));

    this.messagesService.getMessages(conv.id).subscribe({
      next: (res) => {
        this.messages.set(res);
        this.scrollToBottom();
      },
      error: () => {
        this.messages.set([]);
      }
    });
  }

  closeChat(): void {
    this.activeConversation.set(null);
    this.pendingRecipient.set(null);
  }

  openNewMessageModal(): void {
    this.showNewMessageModal.set(true);
    this.pickerQuery.set('');
    this.loadFollowingForPicker();
  }

  private loadFollowingForPicker(): void {
    const userId = this.auth.user()?.id;
    if (!userId) {
      this.pickerUsers.set([]);
      return;
    }
    this.pickerLoading.set(true);
    this.profileService.getFollowing(userId).subscribe({
      next: (users) => {
        this.pickerUsers.set(users);
        this.pickerLoading.set(false);
      },
      error: () => {
        this.pickerUsers.set([]);
        this.pickerLoading.set(false);
      },
    });
  }

  onPickerQueryInput(value: string): void {
    this.pickerQuery.set(value);
    if (this.pickerSearchDebounce) clearTimeout(this.pickerSearchDebounce);

    const query = value.trim();
    if (!query) {
      this.loadFollowingForPicker();
      return;
    }

    this.pickerSearchDebounce = setTimeout(() => {
      this.pickerLoading.set(true);
      this.profileService.searchUsers(query).subscribe({
        next: (users) => {
          this.pickerUsers.set(users);
          this.pickerLoading.set(false);
        },
        error: () => {
          this.pickerUsers.set([]);
          this.pickerLoading.set(false);
        },
      });
    }, 300);
  }

  selectRecipient(user: User): void {
    // If a conversation with this user already exists, just open it instead
    // of starting a duplicate one.
    const existing = this.conversations().find((c) => c.other_user.id === user.id);
    this.showNewMessageModal.set(false);
    if (existing) {
      this.selectConversation(existing);
      return;
    }
    this.activeConversation.set(null);
    this.messages.set([]);
    this.pendingRecipient.set(user);
  }

  sendMessage() {
    if (!this.newMessage.trim()) return;
    if (!this.activeConversation() && !this.pendingRecipient()) return;

    const content = this.newMessage;
    this.newMessage = '';

    const recipientId = this.activeConversation()?.other_user.id ?? this.pendingRecipient()!.id;

    this.messagesService.sendMessage(recipientId, content).subscribe({
      next: (msg) => {
        if (this.pendingRecipient()) {
          // First message to a new recipient — the conversation now exists
          // server-side; reload the list and switch over to it.
          const recipient = this.pendingRecipient()!;
          this.pendingRecipient.set(null);
          this.messages.set([msg]);
          this.messagesService.getConversations().subscribe((convs) => {
            this.conversations.set(convs);
            const created = convs.find((c) => c.id === msg.conversation_id) ?? {
              id: msg.conversation_id,
              other_user: recipient,
              last_message_at: msg.created_at,
              unread_count: 0,
              last_message_preview: msg.content,
            };
            this.activeConversation.set(created);
          });
        } else {
          this.messages.update(list => [...list, msg]);
        }
        this.scrollToBottom();
      },
      error: (err) => {
        this.toast.error(apiErrorMessage(err, this.translate.instant('COMMUNITY.MESSAGES.SEND_ERROR')));
      }
    });
  }

  onMessageEnter(event: Event): void {
    const keyboardEvent = event as KeyboardEvent;
    if (keyboardEvent.shiftKey) return;
    event.preventDefault();
    this.sendMessage();
  }

  ngAfterViewChecked() {
    this.scrollToBottom();
  }

  private scrollToBottom(): void {
    try {
      if (this.messagesContainer) {
        this.messagesContainer.nativeElement.scrollTop = this.messagesContainer.nativeElement.scrollHeight;
      }
    } catch(err) { }
  }
}
