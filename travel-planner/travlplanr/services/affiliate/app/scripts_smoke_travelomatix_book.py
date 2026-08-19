"""One-off Travelomatix sandbox smoke: Search → RoomList → Block → Book → Cancel."""

from __future__ import annotations

import asyncio
import json

from app.adapters.providers import travelomatix_hotels as tm


async def main() -> None:
    print("1) SEARCH")
    items = await tm.search_hotels_travelomatix("Bangalore, India", "budget", date="2026-09-10")
    if not items:
        items = await tm.search_hotels_travelomatix("Bangalore, India", None, date="2026-09-10")
    if not items:
        raise SystemExit("search returned no hotels")
    # Prefer cheapest inventory row for sandbox wallet.
    hotel = min(items, key=lambda i: float(i.price or 1e12))
    token = str(hotel.details["resultToken"])
    print(f"   hotel={hotel.title!r} price={hotel.price} {hotel.currency}")
    print(f"   has_result_token={bool(token)}")

    print("2) ROOMLIST")
    rooms_resp = await tm.get_room_list(token)
    room_rows = (
        ((rooms_resp.get("RoomList") or {}).get("GetHotelRoomResult") or {}).get("HotelRoomsDetails")
        or []
    )
    if isinstance(room_rows, dict):
        room_rows = [room_rows]
    if not room_rows:
        raise SystemExit("no rooms from RoomList")

    def _room_price(row: dict) -> float:
        try:
            return float((row.get("Price") or {}).get("OfferedPrice") or 1e12)
        except (TypeError, ValueError):
            return 1e12

    first = min(room_rows, key=_room_price)
    room_id = str(first.get("RoomUniqueId") or "")
    if not room_id:
        raise SystemExit("no RoomUniqueId from RoomList")
    print(
        f"   rooms={len(room_rows)} first={first.get('RoomTypeName')!r} "
        f"offered={(first.get('Price') or {}).get('OfferedPrice')}"
    )

    print("3) BLOCKROOM")
    blocked = await tm.block_room(token, [room_id])
    block = (blocked.get("BlockRoom") or {}).get("BlockRoomResult") or {}
    block_id = block.get("BlockRoomId")
    print(
        f"   Status={blocked.get('Status')} "
        f"IsPriceChanged={block.get('IsPriceChanged')} "
        f"IsCancellationPolicyChanged={block.get('IsCancellationPolicyChanged')}"
    )
    print(f"   has_block_room_id={bool(block_id)}")
    if not block_id:
        print("   block_response_keys=", list(blocked.keys()), list(block.keys())[:20])
        raise SystemExit("BlockRoomId missing")

    print("4) COMMITBOOKING")
    app_ref = tm._app_reference()
    try:
        booking_resp = await tm.commit_booking(
            result_token=token,
            block_room_id=str(block_id),
            app_reference=app_ref,
            room_details=[
                {
                    "PassengerDetails": [
                        {
                            "Title": "Mr",
                            "FirstName": "Sandbox",
                            "MiddleName": "",
                            "LastName": "Tester",
                            "Phoneno": "9000000000",
                            "Email": "sandbox.tester@travlplanr.local",
                            "PaxType": "1",
                            "LeadPassenger": True,
                            "Age": 30,
                        }
                    ]
                }
            ],
        )
    except RuntimeError as exc:
        print(f"   commit_error={exc}")
        # Still exercise cancel endpoint shape against a non-existent ref (expected fail).
        print("5) CANCELBOOKING (no successful book — probing endpoint)")
        try:
            cancel = await tm.cancel_booking(str(app_ref))
            print(f"   Status={cancel.get('Status')} Message={cancel.get('Message')!r}")
            print(f"   body_keys={list(cancel.keys())}")
        except Exception as cancel_exc:  # noqa: BLE001
            print(f"   cancel_probe_error={cancel_exc}")
        print("DONE_WITH_BALANCE_BLOCK")
        return

    details = ((booking_resp.get("CommitBooking") or {}).get("BookingDetails") or {})
    print(f"   Status={booking_resp.get('Status')} Message={booking_resp.get('Message')!r}")
    print(f"   booking_status={details.get('booking_status')!r}")
    print(f"   has_confirmation={bool(details.get('ConfirmationNo'))}")
    print(f"   has_booking_ref={bool(details.get('BookingRefNo'))}")
    print(f"   has_booking_id={bool(details.get('BookingId'))}")
    print(f"   app_reference={app_ref}")

    if booking_resp.get("Status") in (0, "0", False):
        print("   FULL booking_response:", json.dumps(booking_resp)[:1200])
        raise SystemExit("booking failed")

    print("5) UPDATEHOLDBOOKING")
    try:
        hold = await tm.update_hold_booking(str(app_ref))
        print(f"   Status={hold.get('Status')} Message={hold.get('Message')!r}")
        print(f"   booking_id={((hold.get('UpdateHoldBooking') or {}).get('booking_id'))!r}")
    except Exception as exc:  # noqa: BLE001
        print(f"   hold_status_error={exc}")

    print("6) CANCELBOOKING")
    cancel = await tm.cancel_booking(str(app_ref))
    cdet = ((cancel.get("CancelBooking") or {}).get("CancellationDetails") or {})
    print(f"   Status={cancel.get('Status')} Message={cancel.get('Message')!r}")
    print(f"   StatusDescription={cdet.get('StatusDescription')!r}")
    print(f"   ChangeRequestStatus={cdet.get('ChangeRequestStatus')!r}")
    print(f"   ChangeRequestId={cdet.get('ChangeRequestId')!r}")
    print(
        f"   RefundedAmount={cdet.get('RefundedAmount')!r} "
        f"CancellationCharge={cdet.get('CancellationCharge')!r}"
    )

    crid = cdet.get("ChangeRequestId")
    if crid is not None:
        print("7) CANCELLATIONREFUNDDETAILS")
        try:
            refund = await tm.cancellation_refund_details(crid, str(app_ref))
            rdet = refund.get("RefundDetails") or {}
            print(f"   Status={refund.get('Status')}")
            print(f"   StatusDescription={rdet.get('StatusDescription')!r}")
            print(
                f"   RefundedAmount={rdet.get('RefundedAmount')!r} "
                f"CancellationCharge={rdet.get('CancellationCharge')!r}"
            )
        except Exception as exc:  # noqa: BLE001
            print(f"   refund_details_error={exc}")

    print("DONE")


if __name__ == "__main__":
    asyncio.run(main())
