"""Models package."""
from app.models.trips import Trip
from app.models.destinations import Destination
from app.models.destination_requests import DestinationRequest
from app.models.packages import Package
from app.models.cms import BlogPost, FaqSection, FaqItem
from app.models.inventory import InventoryItem
from app.models.promotions import Promotion
from app.models.support import SupportTicket
from app.models.reviews import Review
from app.models.communications import ChatSession, ChatMessage
from app.models.community import (
    CommunityPost, PostComment, UserFollow, Story, Notification, NotificationPreference,
    Conversation, DirectMessage, CommunityProfile, CommunityShortcut, CommunityNews, CommunityAd,
    CommunityCollection, CommunityCollectionItem, PostReaction, Hashtag, PostHashtag, HashtagFollow,
    CommunityEvent, Report, Block, GamificationProfile, XpEvent, UserBadge, ChallengeProgress,
    CommunityMeetup, MeetupRsvp, Journal, CommunitySpace, SpaceMember,
)
from app.models.collaboration import TripCollaborator, TripInvite, TripActivity, TripExpense, ExpenseShare
from app.models.matching import TravelBuddyProfile, TravelBuddyRequest
from app.models.ai_learning import (
    ChatInteraction,
    ActivityOutcome,
    ActivityAcceptanceStat,
    CustomerTravelProfile,
    PromptVersion,
)

__all__ = [
    "Trip", "Destination", "DestinationRequest", "Package", "BlogPost", "FaqSection", "FaqItem",
    "InventoryItem", "Promotion", "SupportTicket", "Review", "ChatSession", "ChatMessage",
    "CommunityPost", "PostComment", "UserFollow", "Story", "Notification", "NotificationPreference",
    "Conversation", "DirectMessage", "CommunityProfile", "CommunityShortcut", "CommunityNews",
    "CommunityAd", "CommunityCollection", "CommunityCollectionItem", "PostReaction", "Hashtag",
    "PostHashtag", "HashtagFollow", "CommunityEvent", "Report", "Block", "GamificationProfile",
    "XpEvent", "UserBadge", "ChallengeProgress", "CommunityMeetup", "MeetupRsvp", "Journal",
    "CommunitySpace", "SpaceMember", "TripCollaborator", "TripInvite",
    "TripActivity", "TripExpense", "ExpenseShare", "TravelBuddyProfile", "TravelBuddyRequest",
    "ChatInteraction", "ActivityOutcome", "ActivityAcceptanceStat", "CustomerTravelProfile", "PromptVersion",
]
