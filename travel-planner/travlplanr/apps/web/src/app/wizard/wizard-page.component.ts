import { Component, inject, effect, OnInit, DestroyRef } from '@angular/core';
import { ComponentCanDeactivate } from '../shared/guards/pending-changes.guard';
import { FormBuilder, ReactiveFormsModule, Validators, FormArray, FormControl } from '@angular/forms';
import { Router } from '@angular/router';
import { Subscription, interval, of, timer } from 'rxjs';
import { take, switchMap, takeWhile, takeUntil, catchError } from 'rxjs/operators';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AuthService } from '../auth/auth.service';
import { TripService } from '../trip/trip.service';
import { WizardStore } from './wizard.store';
import { BudgetTier, TravelStyle } from './store/wizard.models';
import { ImgFallbackDirective } from '../shared/directives/img-fallback.directive';

const INTERESTS = [
  { id: 'Adventure', label: 'WIZARD.INTERESTS.ADVENTURE' },
  { id: 'Beach', label: 'WIZARD.INTERESTS.BEACH' },
  { id: 'Culture', label: 'WIZARD.INTERESTS.CULTURE' },
  { id: 'Food', label: 'WIZARD.INTERESTS.FOOD' },
  { id: 'Nightlife', label: 'WIZARD.INTERESTS.NIGHTLIFE' },
  { id: 'Nature', label: 'WIZARD.INTERESTS.NATURE' },
  { id: 'City', label: 'WIZARD.INTERESTS.CITY' },
  { id: 'Shopping', label: 'WIZARD.INTERESTS.SHOPPING' },
];
const FOOD_PREFS = [
  { id: 'no_preference', label: 'WIZARD.FOOD.NO_PREFERENCE.LABEL', sub: 'WIZARD.FOOD.NO_PREFERENCE.SUB' },
  { id: 'vegetarian', label: 'WIZARD.FOOD.VEGETARIAN.LABEL', sub: 'WIZARD.FOOD.VEGETARIAN.SUB' },
  { id: 'vegan', label: 'WIZARD.FOOD.VEGAN.LABEL', sub: 'WIZARD.FOOD.VEGAN.SUB' },
  { id: 'halal', label: 'WIZARD.FOOD.HALAL.LABEL', sub: 'WIZARD.FOOD.HALAL.SUB' },
  { id: 'jain', label: 'WIZARD.FOOD.JAIN.LABEL', sub: 'WIZARD.FOOD.JAIN.SUB' },
  { id: 'gluten_free', label: 'WIZARD.FOOD.GLUTEN_FREE.LABEL', sub: 'WIZARD.FOOD.GLUTEN_FREE.SUB' }
];
const STYLES: { id: TravelStyle; label: string; sub: string }[] = [
  { id: 'solo', label: 'WIZARD.STYLES.SOLO.LABEL', sub: 'WIZARD.STYLES.SOLO.SUB' },
  { id: 'couple', label: 'WIZARD.STYLES.COUPLE.LABEL', sub: 'WIZARD.STYLES.COUPLE.SUB' },
  { id: 'friends', label: 'WIZARD.STYLES.FRIENDS.LABEL', sub: 'WIZARD.STYLES.FRIENDS.SUB' },
  { id: 'family', label: 'WIZARD.STYLES.FAMILY.LABEL', sub: 'WIZARD.STYLES.FAMILY.SUB' },
];
const BUDGETS: { id: BudgetTier; label: string; sub: string }[] = [
  { id: 'budget', label: 'WIZARD.BUDGETS.BUDGET.LABEL', sub: 'WIZARD.BUDGETS.BUDGET.SUB' },
  { id: 'mid', label: 'WIZARD.BUDGETS.MID.LABEL', sub: 'WIZARD.BUDGETS.MID.SUB' },
  { id: 'luxury', label: 'WIZARD.BUDGETS.LUXURY.LABEL', sub: 'WIZARD.BUDGETS.LUXURY.SUB' },
];

import { CommonModule, DecimalPipe, DatePipe } from '@angular/common';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { LoadingOverlayComponent } from '../shared/components/loading-overlay/loading-overlay.component';
import { PrimaryButtonComponent } from 'ui';
import { ToastService } from '../shared/utils/toast.service';
import { ProfileService } from '../profile/profile.service';

@Component({
    selector: 'app-wizard-page',
    imports: [ReactiveFormsModule, CommonModule, DecimalPipe, DatePipe, LoadingOverlayComponent, PrimaryButtonComponent, TranslatePipe, ImgFallbackDirective],
    template: `
    <div class="section-container py-10 flex justify-center">

      @if (generating()) {
        <app-loading-overlay [message]="'WIZARD.FETCHING' | translate" />
      } @else {
        <div class="w-full flex flex-col items-center">
          <div class="text-center mb-8">
            <h1 class="text-5xl font-semibold text-primary">{{ 'WIZARD.TITLE' | translate }}</h1>
            <p class="text-base text-text-secondary mt-1">{{ 'WIZARD.SUBTITLE' | translate }}</p>
          </div>
          <div class="w-full max-w-[846px] rounded-tile shadow-[0_4px_24px_rgba(0,0,0,0.04)] bg-white">
          <!-- Content -->
          <div class="p-8 md:p-12 flex flex-col items-center">
            
            @if (step() <= 5) {
              <!-- Standalone Progress Bar -->
              <div class="mb-12 w-full max-w-[650px]">
                <div class="flex justify-between items-center mb-3">
                  <span class="text-sm font-medium text-text-secondary">{{ 'WIZARD.STEP_OF' | translate: { current: step(), total: 5 } }}</span>
                  <span class="text-sm font-medium text-primary">{{ 'WIZARD.PERCENT_COMPLETED' | translate: { percent: (step() / 5) * 100 } }}</span>
                </div>
                <div class="h-2.5 w-full bg-border-light rounded-full overflow-hidden shadow-inner">
                  <div class="h-full bg-primary rounded-full transition-all duration-700 ease-out shadow-[0_0_12px_rgba(0,96,234,0.6)] relative overflow-hidden" [style.width.%]="(step() / 5) * 100">
                    <div class="absolute inset-0 bg-white/20 animate-pulse"></div>
                  </div>
                </div>
              </div>
            }

            <!-- Main Flow -->
            <div class="w-full max-w-[650px] flex flex-col">
              @switch (step()) {
                @case (1) {
                  <div class="w-full animate-fade-in-up">
                  <div class="flex flex-col items-center text-center mb-8">
                    <div class="w-[60px] h-[60px] bg-primary-50 rounded-full flex items-center justify-center text-primary mb-4">
                      <img [src]="'assets/icons/' + getStepIcon() + '.svg'" [alt]="'WIZARD.STEP_ICON_ALT' | translate" appImgFallback class="w-8 h-8 object-contain" />
                    </div>
                    <h2 class="text-3xl font-semibold text-text-primary">{{ 'WIZARD.STEP1.TITLE' | translate }}</h2>
                    <p class="mt-2 text-base text-text-secondary">{{ 'WIZARD.STEP1.SUBTITLE' | translate }}</p>
                  </div>
                  
                  <form class="flex flex-col gap-8 w-full" [formGroup]="step1Form">
                    <div class="flex flex-col gap-4" formArrayName="destinations">
                      @for (destCtrl of destinationsArray.controls; track $index) {
                        <div class="flex items-center gap-2">
                          <div class="border border-border rounded-btn p-4 flex items-center flex-1">
                            <label class="sr-only" [attr.for]="'destination-' + $index">{{ 'WIZARD.STEP1.DESTINATION_LABEL' | translate }}</label>
                            <input type="text" [id]="'destination-' + $index" [formControlName]="$index" [placeholder]="'WIZARD.STEP1.DESTINATION_PLACEHOLDER' | translate" class="w-full text-base bg-transparent outline-none text-text-primary placeholder:text-text-tertiary" />
                          </div>
                          @if (destinationsArray.length > 1) {
                            <button type="button" class="text-danger p-2" [attr.aria-label]="'WIZARD.STEP1.REMOVE_CITY' | translate" (click)="removeDestination($index)">
                              <img src="assets/icons/cancel.svg" alt="" aria-hidden="true" class="w-6 h-6 object-contain" />
                            </button>
                          }
                        </div>
                      }
                      <button type="button" class="flex items-center gap-2 text-primary text-base w-fit hover:opacity-80" (click)="addDestination()">
                        <img src="assets/icons/plus.svg" [alt]="'WIZARD.STEP1.ADD_ALT' | translate" class="w-6 h-6 object-contain" />
                        {{ 'WIZARD.STEP1.ADD_CITY' | translate }}
                      </button>
                    </div>

                    <div class="flex flex-col gap-4">
                      <h3 class="text-xl font-medium text-text-primary">{{ 'WIZARD.STEP1.BEGIN_END' | translate }}</h3>
                      <div class="border border-border rounded-btn p-4 flex items-center">
                        <label class="sr-only" for="departureLocation">{{ 'WIZARD.STEP1.DEPARTURE_LABEL' | translate }}</label>
                        <input type="text" id="departureLocation" formControlName="departureLocation" [placeholder]="'WIZARD.STEP1.DEPARTURE_PLACEHOLDER' | translate" class="w-full text-base bg-transparent outline-none text-text-primary placeholder:text-text-tertiary" />
                      </div>
                      <label class="flex items-center gap-4 cursor-pointer mt-2 w-fit">
                        <input type="checkbox" formControlName="differentArrival" class="w-5 h-5 rounded border-border text-primary focus:ring-primary" />
                        <span class="text-base text-text-primary">{{ 'WIZARD.STEP1.DIFFERENT_ARRIVAL' | translate }}</span>
                      </label>
                      @if (step1Form.get('differentArrival')?.value) {
                        <div class="border border-border rounded-btn p-4 flex items-center mt-1 animate-fade-in-up">
                          <label class="sr-only" for="arrivalLocation">{{ 'WIZARD.STEP1.ARRIVAL_LABEL' | translate }}</label>
                          <input type="text" id="arrivalLocation" formControlName="arrivalLocation" [placeholder]="'WIZARD.STEP1.ARRIVAL_PLACEHOLDER' | translate" class="w-full text-base bg-transparent outline-none text-text-primary placeholder:text-text-tertiary" />
                        </div>
                      }
                    </div>
                  </form>
                  </div>
                }
                @case (2) {
                  <div class="w-full animate-fade-in-up">
                  <div class="flex flex-col items-center text-center mb-8">
                    <div class="w-[60px] h-[60px] bg-primary-50 rounded-full flex items-center justify-center text-primary mb-4">
                      <img [src]="'assets/icons/' + getStepIcon() + '.svg'" [alt]="'WIZARD.STEP_ICON_ALT' | translate" class="w-8 h-8 object-contain" />
                    </div>
                    <h2 class="text-3xl font-semibold text-text-primary">{{ 'WIZARD.STEP2.TITLE' | translate }}</h2>
                    <p class="mt-2 text-base text-text-secondary">{{ 'WIZARD.STEP2.SUBTITLE' | translate }}</p>
                  </div>
                  <form class="flex flex-col gap-8 w-full" [formGroup]="step2Form">
                    <!-- Date Picker (placeholder UI for the 'Select dates' box) -->
                    <div class="flex flex-col gap-4">
                      <div class="border border-border rounded-btn p-4 flex items-center justify-between"
                           [class.opacity-50]="step2Form.value.aiDates"
                           [class.pointer-events-none]="step2Form.value.aiDates"
                           [class.border-red-500]="step2Form.errors?.['pastStartDate'] || step2Form.errors?.['endDateBeforeStart']">
                        <div class="flex flex-1 gap-4 items-center">
                          <label class="sr-only" for="startDate">{{ 'WIZARD.STEP2.START_DATE' | translate }}</label>
                          <input type="date" id="startDate" formControlName="startDate" class="w-full text-base bg-transparent outline-none text-text-primary" />
                          <span class="text-text-secondary">{{ 'WIZARD.STEP2.TO' | translate }}</span>
                          <label class="sr-only" for="endDate">{{ 'WIZARD.STEP2.END_DATE' | translate }}</label>
                          <input type="date" id="endDate" formControlName="endDate" class="w-full text-base bg-transparent outline-none text-text-primary" />
                        </div>
                        <img src="assets/icons/calendar.svg" [alt]="'WIZARD.STEP2.CALENDAR_ALT' | translate" class="w-6 h-6 object-contain ml-4 shrink-0" />
                      </div>
                      @if (step2Form.errors?.['pastStartDate']) {
                        <p class="text-sm text-red-500 mt-1">{{ 'WIZARD.STEP2.PAST_START_DATE' | translate }}</p>
                      }
                      @if (step2Form.errors?.['endDateBeforeStart']) {
                        <p class="text-sm text-red-500 mt-1">{{ 'WIZARD.STEP2.END_BEFORE_START' | translate }}</p>
                      }
                    </div>

                    <!-- AI Selection -->
                    <div class="border border-primary rounded-btn p-4 flex gap-4 items-start bg-primary-50">
                      <input type="checkbox" formControlName="aiDates" class="w-5 h-5 mt-1 rounded border-border text-primary focus:ring-primary shrink-0" />
                      <div class="flex flex-col">
                        <span class="text-base font-medium text-text-primary">{{ 'WIZARD.STEP2.AI_DATES' | translate }}</span>
                        <span class="text-sm text-text-secondary mt-1">{{ 'WIZARD.STEP2.AI_DATES_HINT' | translate }}</span>
                      </div>
                    </div>

                    <!-- City Summaries -->
                    <div class="flex flex-col gap-4 mt-4" formArrayName="cityDays">
                      @for (cityGroup of cityDaysFormArray.controls; track $index) {
                        <div class="border border-border rounded-btn p-4 flex items-center justify-between" [formGroupName]="$index">
                          <div class="flex flex-col">
                            <span class="text-base font-medium text-primary">{{ cityGroup.get('city')?.value }}</span>
                            <span class="text-sm text-text-secondary mt-1">
                              @if (step2Form.value.aiDates) {
                                {{ 'WIZARD.STEP2.FLEXIBLE_DATES' | translate }}
                              } @else if (step2Form.value.startDate && step2Form.value.endDate) {
                                {{ step2Form.value.startDate }} - {{ step2Form.value.endDate }}
                              } @else {
                                {{ 'WIZARD.STEP2.SELECT_DATES' | translate }}
                              }
                            </span>
                          </div>
                          
                          <!-- Counter Stays -->
                          <div class="flex items-center gap-4 bg-surface-muted border border-border rounded-full px-4 py-2">
                            <button type="button" class="text-primary disabled:opacity-50" [attr.aria-label]="'WIZARD.STEP2.DECREASE_NIGHTS' | translate" (click)="decrementCityDays($index)" [disabled]="cityGroup.get('nights')?.value <= 1">
                                <img src="assets/icons/minus.svg" alt="" aria-hidden="true" class="w-5 h-5 object-contain" />
                            </button>
                            <span class="text-base font-medium text-primary w-6 text-center">{{ 'WIZARD.STEP2.NIGHTS_SHORT' | translate: { n: cityGroup.get('nights')?.value } }}</span>
                            <button type="button" class="text-primary disabled:opacity-50" [attr.aria-label]="'WIZARD.STEP2.INCREASE_NIGHTS' | translate" (click)="incrementCityDays($index)" [disabled]="cityGroup.get('nights')?.value >= 30">
                                <img src="assets/icons/plus-small.svg" alt="" aria-hidden="true" class="w-5 h-5 object-contain" />
                            </button>
                          </div>
                        </div>
                      }
                    </div>
                  </form>
                  </div>
                }
                @case (3) {
                  <div class="w-full animate-fade-in-up">
                  <div class="flex flex-col items-center text-center mb-8">
                    <div class="w-[60px] h-[60px] bg-primary-50 rounded-full flex items-center justify-center text-primary mb-4">
                      <img [src]="'assets/icons/' + getStepIcon() + '.svg'" [alt]="'WIZARD.STEP_ICON_ALT' | translate" class="w-8 h-8 object-contain" />
                    </div>
                    <h2 class="text-3xl font-semibold text-text-primary">{{ 'WIZARD.STEP3.TITLE' | translate }}</h2>
                    <p class="mt-2 text-base text-text-secondary">{{ 'WIZARD.STEP3.SUBTITLE' | translate }}</p>
                  </div>
                  <div class="space-y-8 w-full">
                    <div>
                      <p class="mb-3 text-base font-medium text-text-primary text-center">{{ 'WIZARD.STEP3.TRAVEL_GROUP' | translate }}</p>
                      <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
                        @for (style of styles; track style.id) {
                          <button
                            type="button"
                            class="flex flex-col items-center justify-center rounded-tile border p-4 text-center transition-all duration-300 hover-scale hover-glow"
                            [class.border-primary]="selectedStyle() === style.id"
                            [class.bg-primary-50]="selectedStyle() === style.id"
                            [class.border-border]="selectedStyle() !== style.id"
                            (click)="selectStyle(style.id)"
                          >
                            <img [src]="'assets/icons/' + style.id + '.svg'" [alt]="style.label | translate" appImgFallback class="w-8 h-8 mb-2 object-contain"/>
                            <span class="text-base font-medium text-text-primary mb-1">{{ style.label | translate }}</span>
                            <span class="text-xs text-text-secondary">{{ style.sub | translate }}</span>
                          </button>
                        }
                      </div>
                      @if (selectedStyle()) {
                        <div class="mt-6 flex flex-col items-center animate-fade-in-up">
                          <p class="mb-2 text-sm font-semibold text-text-secondary">{{ 'WIZARD.STEP3.NUM_TRAVELERS' | translate }}</p>
                          <div class="flex items-center gap-4 bg-white border border-border rounded-full px-4 py-2 shadow-sm">
                            <button type="button" class="text-primary disabled:opacity-50 font-bold text-lg px-2" (click)="adjustTravelers(-1)" [disabled]="travelersCount <= 1">
                              -
                            </button>
                            <span class="text-base font-semibold text-text-primary w-24 text-center">
                              {{ travelersCount }} {{ (travelersCount === 1 ? 'WIZARD.STEP3.TRAVELER' : 'WIZARD.STEP3.TRAVELERS') | translate }}
                            </span>
                            <button type="button" class="text-primary disabled:opacity-50 font-bold text-lg px-2" (click)="adjustTravelers(1)" [disabled]="travelersCount >= 20">
                              +
                            </button>
                          </div>
                        </div>
                      }
                    </div>
                    <div>
                      <p class="mb-3 text-base font-medium text-text-primary text-center">{{ 'WIZARD.STEP3.TRAVEL_METHOD' | translate }}</p>
                      <div class="grid grid-cols-2 gap-4">
                        <button
                          type="button"
                          class="flex items-center gap-4 rounded-tile border p-4 transition-all duration-300 hover-scale hover-glow"
                          [class.border-primary]="selectedMethod() === 'rental_car'"
                          [class.bg-primary-50]="selectedMethod() === 'rental_car'"
                          [class.border-border]="selectedMethod() !== 'rental_car'"
                          (click)="selectMethod('rental_car')"
                        >
                          <img src="assets/icons/rental-car.svg" [alt]="'WIZARD.STEP3.RENTAL_CARS' | translate" class="w-8 h-8 object-contain"/>
                          <div class="text-left">
                            <span class="block text-base font-medium text-text-primary">{{ 'WIZARD.STEP3.RENTAL_CARS' | translate }}</span>
                            <span class="block text-xs text-text-secondary">{{ 'WIZARD.STEP3.RENTAL_CARS_SUB' | translate }}</span>
                          </div>
                        </button>
                        <button
                          type="button"
                          class="flex items-center gap-4 rounded-tile border p-4 transition-all duration-300 hover-scale hover-glow"
                          [class.border-primary]="selectedMethod() === 'cab_taxi'"
                          [class.bg-primary-50]="selectedMethod() === 'cab_taxi'"
                          [class.border-border]="selectedMethod() !== 'cab_taxi'"
                          (click)="selectMethod('cab_taxi')"
                        >
                          <img src="assets/icons/cab.svg" [alt]="'WIZARD.STEP3.CAB_TAXI' | translate" class="w-8 h-8 object-contain"/>
                          <div class="text-left">
                            <span class="block text-base font-medium text-text-primary">{{ 'WIZARD.STEP3.CAB_TAXI' | translate }}</span>
                            <span class="block text-xs text-text-secondary">{{ 'WIZARD.STEP3.CAB_TAXI_SUB' | translate }}</span>
                          </div>
                        </button>
                      </div>
                    </div>
                  </div>
                  </div>
                }
                @case (4) {
                  <div class="w-full animate-fade-in-up">
                  <div class="flex flex-col items-center text-center mb-8">
                    <div class="w-[60px] h-[60px] bg-primary-50 rounded-full flex items-center justify-center text-primary mb-4">
                      <img [src]="'assets/icons/' + getStepIcon() + '.svg'" [alt]="'WIZARD.STEP_ICON_ALT' | translate" class="w-8 h-8 object-contain" />
                    </div>
                    <h2 class="text-3xl font-semibold text-text-primary">{{ 'WIZARD.STEP4.TITLE' | translate }}</h2>
                    <p class="mt-2 text-base text-text-secondary">{{ 'WIZARD.STEP4.SUBTITLE' | translate }}</p>
                  </div>
                  <div class="w-full">
                    <p class="mb-3 text-base font-medium text-text-primary text-center">{{ 'WIZARD.STEP4.SELECT_INTERESTS' | translate }}</p>
                    <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
                      @for (interest of interests; track interest.id) {
                        <button
                          type="button"
                          class="flex flex-col items-center justify-center p-4 border rounded-xl gap-3 text-center transition-all duration-300 hover-scale hover-glow"
                          [class.border-primary]="selectedInterests().includes(interest.id)"
                          [class.bg-primary-50]="selectedInterests().includes(interest.id)"
                          [class.text-primary]="selectedInterests().includes(interest.id)"
                          [class.border-border]="!selectedInterests().includes(interest.id)"
                          [class.text-text-primary]="!selectedInterests().includes(interest.id)"
                          [class.hover:border-primary]="!selectedInterests().includes(interest.id)"
                          (click)="toggleInterest(interest.id)"
                        >
                          <div class="w-8 h-8 flex items-center justify-center">
                            @switch (interest.id) {
                              @case ('Adventure') {
                                <img src="assets/icons/mountain.svg" [alt]="interest.label | translate" class="w-8 h-8 object-contain"/>
                              }
                              @case ('Beach') {
                                <img src="assets/icons/coconut-tree.svg" [alt]="interest.label | translate" class="w-8 h-8 object-contain"/>
                              }
                              @case ('Culture') {
                                <img src="assets/icons/pray.svg" [alt]="interest.label | translate" class="w-8 h-8 object-contain"/>
                              }
                              @case ('Food') {
                                <img src="assets/icons/cutlery.svg" [alt]="interest.label | translate" class="w-8 h-8 object-contain"/>
                              }
                              @case ('Nightlife') {
                                <img src="assets/icons/drama.svg" [alt]="interest.label | translate" class="w-8 h-8 object-contain"/>
                              }
                              @case ('Nature') {
                                <img src="assets/icons/nature.svg" [alt]="interest.label | translate" class="w-8 h-8 object-contain"/>
                              }
                              @case ('City') {
                                <img src="assets/icons/city.svg" [alt]="interest.label | translate" class="w-8 h-8 object-contain"/>
                              }
                              @case ('Shopping') {
                                <img src="assets/icons/shopping.svg" [alt]="interest.label | translate" class="w-8 h-8 object-contain"/>
                              }
                            }
                          </div>
                          <span class="text-sm font-semibold whitespace-pre-line leading-tight">{{ interest.label | translate }}</span>
                        </button>
                      }
                    </div>
                  </div>
                  </div>
                }
                @case (5) {
                  <div class="w-full animate-fade-in-up">
                  <div class="space-y-8 w-full">
                    <div>
                      <div class="flex flex-col items-center text-center mb-6">
                        <div class="w-[60px] h-[60px] bg-primary-50 rounded-full flex items-center justify-center text-primary mb-4">
                          <img src="assets/icons/money-bag.svg" [alt]="'WIZARD.STEP5.BUDGET_ALT' | translate" class="w-8 h-8 object-contain" />
                        </div>
                        <h2 class="text-3xl font-semibold text-text-primary">{{ 'WIZARD.STEP5.TITLE' | translate }}</h2>
                        <p class="mt-2 text-base text-text-secondary">{{ 'WIZARD.STEP5.SUBTITLE' | translate }}</p>
                      </div>
                      <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                        @for (b of budgets; track b.id) {
                          <button
                            type="button"
                            class="flex flex-col items-center justify-center rounded-tile border p-4 text-center transition-all duration-300 hover-scale hover-glow"
                            [class.border-primary]="selectedBudget() === b.id"
                            [class.bg-primary-50]="selectedBudget() === b.id"
                            [class.border-border]="selectedBudget() !== b.id"
                            (click)="selectBudget(b.id)"
                          >
                            <img [src]="'assets/icons/' + b.id + '.svg'" [alt]="b.label | translate" class="w-8 h-8 mb-2 object-contain"/>
                            <span class="text-base font-medium text-text-primary mb-1">{{ b.label | translate }}</span>
                            <span class="text-xs text-text-secondary">{{ b.sub | translate }}</span>
                          </button>
                        }
                      </div>
                    </div>
                    <div class="w-full h-px border-t border-dashed border-border my-2"></div>
                    <div>
                      <div class="flex flex-col items-center text-center mb-6 mt-6">
                        <div class="w-[60px] h-[60px] bg-primary-50 rounded-full flex items-center justify-center text-primary mb-4">
                          <img src="assets/icons/menu.svg" [alt]="'WIZARD.STEP5.FOOD_ALT' | translate" class="w-8 h-8 object-contain" />
                        </div>
                        <h2 class="text-3xl font-semibold text-text-primary">{{ 'WIZARD.STEP5.FOOD_TITLE' | translate }}</h2>
                        <p class="mt-2 text-base text-text-secondary">{{ 'WIZARD.STEP5.FOOD_SUBTITLE' | translate }}</p>
                      </div>
                      <div class="grid grid-cols-2 md:grid-cols-3 gap-4">
                        @for (fp of foodPrefs; track fp.id) {
                          <button
                            type="button"
                            class="flex flex-col items-center justify-center rounded-tile border p-4 text-center transition-all duration-300 hover-scale hover-glow"
                            [class.border-primary]="selectedFoodPrefs().includes(fp.id)"
                            [class.bg-primary-50]="selectedFoodPrefs().includes(fp.id)"
                            [class.border-border]="!selectedFoodPrefs().includes(fp.id)"
                            (click)="toggleFoodPref(fp.id)"
                          >
                            <img [src]="'assets/icons/' + fp.id + '.svg'" [alt]="fp.label | translate" class="w-8 h-8 mb-2 object-contain"/>
                            <span class="text-base font-medium text-text-primary mb-1">{{ fp.label | translate }}</span>
                            <span class="text-xs text-text-secondary">{{ fp.sub | translate }}</span>
                          </button>
                        }
                      </div>
                    </div>
                  </div>
                  </div>
                }
                @case (6) {
                  <div class="w-full animate-fade-in-up">
                  <div class="flex flex-col items-center text-center mb-8">
                    <div class="w-[60px] h-[60px] bg-primary-50 rounded-full flex items-center justify-center text-primary mb-4">
                      <img [src]="'assets/icons/' + getStepIcon() + '.svg'" [alt]="'WIZARD.STEP_ICON_ALT' | translate" class="w-8 h-8 object-contain" />
                    </div>
                    <h2 class="text-3xl font-semibold text-text-primary">{{ 'WIZARD.STEP6.TITLE' | translate }}</h2>
                    <p class="mt-2 text-base text-text-secondary">{{ 'WIZARD.STEP6.SUBTITLE' | translate }}</p>
                  </div>
                  
                  <div class="flex flex-col gap-6 w-full text-left">
                    <!-- Route -->
                    <div class="flex items-start gap-4 p-5">
                      <div class="flex items-center justify-center shrink-0 mt-1">
                        <img src="assets/icons/plane.svg" [alt]="'WIZARD.STEP6.ROUTE' | translate" class="w-6 h-6 object-contain" />
                      </div>
                      <div class="flex flex-col w-full">
                        <h3 class="text-lg font-medium text-text-primary mb-3">{{ 'WIZARD.STEP6.ROUTE' | translate }}</h3>
                        <div class="flex flex-col gap-1 mb-4">
                          <p class="text-sm text-text-primary">{{ step1Form.value.departureLocation }} <span class="text-text-secondary">({{ 'WIZARD.STEP6.DEPARTURE' | translate }})</span></p>
                          @if (step1Form.value.differentArrival) {
                            <p class="text-sm text-text-primary">{{ 'WIZARD.STEP6.DIFFERENT_LOCATION' | translate }} <span class="text-text-secondary">({{ 'WIZARD.STEP6.ARRIVAL' | translate }})</span></p>
                          } @else {
                            <p class="text-sm text-text-primary">{{ step1Form.value.departureLocation }} <span class="text-text-secondary">({{ 'WIZARD.STEP6.ARRIVAL' | translate }})</span></p>
                          }
                        </div>
                        <h4 class="text-sm font-medium text-text-primary mb-2">{{ 'WIZARD.STEP6.DESTINATIONS' | translate }}</h4>
                        <div class="flex flex-wrap gap-2">
                          @for (dest of step1Form.value.destinations; track $index) {
                            <span class="px-3 py-1 bg-primary-50 text-primary text-xs font-medium rounded-full">{{ dest }}</span>
                          }
                        </div>
                      </div>
                    </div>

                    <!-- Date -->
                    <div class="flex items-start gap-4 p-5">
                      <div class="flex items-center justify-center shrink-0 mt-1">
                        <img src="assets/icons/calendar-3.svg" [alt]="'WIZARD.STEP6.DATE' | translate" class="w-6 h-6 object-contain" />
                      </div>
                      <div class="flex flex-col">
                        <h3 class="text-lg font-medium text-text-primary mb-2">{{ 'WIZARD.STEP6.DATE' | translate }}</h3>
                        <p class="text-sm text-text-primary">
                          @if (step2Form.value.aiDates) {
                            {{ 'WIZARD.STEP6.AI_FLEXIBLE' | translate }}
                          } @else {
                            {{ step2Form.value.startDate | date:'MMM dd, yyyy' }} - {{ step2Form.value.endDate | date:'MMM dd, yyyy' }}
                          }
                        </p>
                        <p class="text-xs text-text-secondary mt-1">{{ 'WIZARD.STEP6.DURATION' | translate: { n: getTotalDays() } }}</p>
                      </div>
                    </div>

                    <!-- Trip Type -->
                    <div class="flex items-start gap-4 p-5">
                      <div class="flex items-center justify-center shrink-0 mt-1">
                        <img src="assets/icons/passport.svg" [alt]="'WIZARD.STEP6.TRIP_TYPE' | translate" class="w-6 h-6 object-contain" />
                      </div>
                      <div class="flex flex-col">
                        <h3 class="text-lg font-medium text-text-primary mb-2">{{ 'WIZARD.STEP6.TRIP_TYPE' | translate }}</h3>
                        <p class="text-sm text-text-primary capitalize">{{ selectedStyle() }} ({{ travelersForStyle(selectedStyle()) }} {{ (travelersForStyle(selectedStyle()) === 1 ? 'WIZARD.STEP6.PERSON' : 'WIZARD.STEP6.PEOPLE') | translate }})</p>
                      </div>
                    </div>

                    <!-- Trip Style -->
                    <div class="flex items-start gap-4 p-5">
                      <div class="flex items-center justify-center shrink-0 mt-1">
                        <img src="assets/icons/trip.svg" [alt]="'WIZARD.STEP6.TRIP_STYLE' | translate" class="w-6 h-6 object-contain" />
                      </div>
                      <div class="flex flex-col w-full">
                        <h3 class="text-lg font-medium text-text-primary mb-3">{{ 'WIZARD.STEP6.TRIP_STYLE' | translate }}</h3>
                        <div class="flex flex-wrap gap-2">
                          @for (interest of selectedInterests(); track interest) {
                            <span class="px-3 py-1 bg-orange-50 text-orange-600 text-xs font-medium rounded-full capitalize">{{ getInterestLabel(interest) | translate }}</span>
                          }
                        </div>
                      </div>
                    </div>

                    <!-- Budget Type -->
                    <div class="flex items-start gap-4 p-5">
                      <div class="flex items-center justify-center shrink-0 mt-1">
                        <img src="assets/icons/money-bag.svg" [alt]="'WIZARD.STEP6.BUDGET_TYPE' | translate" class="w-6 h-6 object-contain" />
                      </div>
                      <div class="flex flex-col">
                        <h3 class="text-lg font-medium text-text-primary mb-3">{{ 'WIZARD.STEP6.BUDGET_TYPE' | translate }}</h3>
                        <div>
                          <span class="px-3 py-1 bg-green-50 text-green-600 text-xs font-medium rounded-full capitalize">{{ getBudgetLabel(selectedBudget()) | translate }}</span>
                        </div>
                      </div>
                    </div>

                    <!-- Food Preference -->
                    <div class="flex items-start gap-4 p-5">
                      <div class="flex items-center justify-center shrink-0 mt-1">
                        <img src="assets/icons/cutlery.svg" [alt]="'WIZARD.STEP6.FOOD_PREFERENCE' | translate" class="w-6 h-6 object-contain" />
                      </div>
                      <div class="flex flex-col w-full">
                        <h3 class="text-lg font-medium text-text-primary mb-3">{{ 'WIZARD.STEP6.FOOD_PREFERENCE' | translate }}</h3>
                        <div class="flex flex-wrap gap-2">
                          @for (fp of selectedFoodPrefs(); track fp) {
                            <span class="px-3 py-1 bg-pink-50 text-pink-600 text-xs font-medium rounded-full capitalize">{{ getFoodPrefLabel(fp) | translate }}</span>
                          }
                        </div>
                      </div>
                    </div>

                    <!-- Transportation -->
                    <div class="flex items-start gap-4 p-5">
                      <div class="flex items-center justify-center shrink-0 mt-1">
                        <img src="assets/icons/car.svg" [alt]="'WIZARD.STEP6.TRANSPORTATION' | translate" class="w-6 h-6 object-contain" />
                      </div>
                      <div class="flex flex-col">
                        <h3 class="text-lg font-medium text-text-primary mb-3">{{ 'WIZARD.STEP6.TRANSPORTATION' | translate }}</h3>
                        <div>
                          <span class="px-3 py-1 bg-purple-50 text-purple-600 text-xs font-medium rounded-full capitalize">{{ getMethodLabel(selectedMethod()) | translate }}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  </div>
                }
              }

              <!-- Divider -->
              <div class="w-full h-px border-t border-dashed border-border my-10"></div>

              <!-- Footer Buttons -->
              <div class="mt-auto flex justify-end gap-4 items-center w-full">
                @if (step() > 1 && step() < 6) {
                  <button type="button" class="flex items-center gap-2 border border-border rounded-btn bg-white px-8 h-12 text-base text-text-primary font-medium hover:bg-surface-muted transition-colors mr-auto" (click)="prev()">
                    <img src="assets/icons/left.svg" [alt]="'WIZARD.BACK' | translate" class="w-5 h-5 object-contain" />
                    {{ 'WIZARD.BACK' | translate }}
                  </button>
                }
                
                @if (step() === 6) {
                  <button type="button" class="flex items-center gap-2 border border-primary rounded-btn bg-white px-8 h-12 text-base text-primary font-medium hover:bg-primary-50 transition-colors" (click)="prev()">
                    {{ 'WIZARD.VIEW_PACKAGES' | translate }}
                  </button>
                }

                @if (step() < 6) {
                  <button
                    type="button"
                    class="btn-shine relative inline-flex h-12 items-center justify-center gap-2 rounded-btn bg-primary px-8 text-base font-medium text-white disabled:opacity-50"
                    [disabled]="!canProceed()"
                    (click)="next()"
                  >
                    @if (step() === 5) {
                      {{ 'WIZARD.REVIEW_PLAN' | translate }}
                      <img src="assets/icons/right.svg" [alt]="'WIZARD.NEXT' | translate" class="w-5 h-5 object-contain" />
                    } @else {
                      {{ 'WIZARD.NEXT' | translate }}
                      <img src="assets/icons/right.svg" [alt]="'WIZARD.NEXT' | translate" class="w-5 h-5 object-contain" />
                    }
                  </button>
                } @else {
                  <app-primary-button widthClass="!px-8" [loading]="generating()" (click)="generate()">
                    {{ 'WIZARD.GENERATE_PLAN' | translate }}
                  </app-primary-button>
                }
              </div>
            </div>
            </div>
          </div>
        </div>
      }
    </div>
  `
})
export class WizardPageComponent implements OnInit, ComponentCanDeactivate {
  private readonly store = inject(WizardStore);
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly tripService = inject(TripService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly profileService = inject(ProfileService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly translate = inject(TranslateService);
  private pollSub?: Subscription;

  canDeactivate(): boolean {
    if (this.generating()) return true;
    if (this.step() > 1 && this.step() <= 5) {
      return window.confirm(this.translate.instant('WIZARD.LEAVE_CONFIRM'));
    }
    return true;
  }

  readonly interests = INTERESTS;
  readonly styles = STYLES;
  readonly budgets = BUDGETS;

  readonly foodPrefs = FOOD_PREFS;

  readonly step = this.store.step;
  readonly generating = this.store.generating;
  readonly summary = this.store.summary;

  readonly destinations = this.store.destinations;
  readonly departureLocation = this.store.departureLocation;
  readonly differentArrival = this.store.differentArrival;
  readonly arrivalLocation = this.store.arrivalLocation;
  readonly aiDates = this.store.aiDates;
  readonly cityDays = this.store.cityDays;

  selectedStyle = this.store.travelStyle;
  selectedMethod = this.store.travelMethod;
  selectedBudget = this.store.budget;
  selectedInterests = this.store.interests;
  selectedFoodPrefs = this.store.foodPreferences;

  // Mirrors the old NgRx subscription that resynced reactive forms whenever
  // the wizard step changed (e.g. from a quick-plan or chat prefill dispatched
  // before this component existed).
  private readonly stepSyncEffect = effect(() => {
    const step = this.step();
    if (step === 1) {
      this.step1Form.patchValue({
        departureLocation: this.departureLocation(),
        differentArrival: this.differentArrival(),
        arrivalLocation: this.arrivalLocation(),
      });
      const dests = this.destinations();
      if (dests.length > 0) {
        this.destinationsArray.clear();
        dests.forEach((d) => this.destinationsArray.push(this.fb.nonNullable.control(d, Validators.required)));
      }
    }
    if (step === 2) {
      this.step2Form.patchValue({
        startDate: this.summary().startDate,
        endDate: this.summary().endDate,
        aiDates: this.aiDates(),
        travelers: this.summary().travelers,
      });

      const dests = this.step1Form.value.destinations || [];
      const existingCityDays = this.cityDays() || [];
      this.cityDaysFormArray.clear();
      dests.forEach((dest) => {
        if (!dest) return;
        const existing = existingCityDays.find((c) => c.city === dest);
        this.cityDaysFormArray.push(
          this.fb.group({
            city: this.fb.nonNullable.control(dest),
            nights: this.fb.nonNullable.control(existing ? existing.nights : 6, [Validators.required, Validators.min(1)]),
          })
        );
      });
    }
  });

  readonly step1Form = this.fb.group({
    destinations: this.fb.array([this.fb.nonNullable.control('', Validators.required)]),
    departureLocation: this.fb.nonNullable.control('', Validators.required),
    differentArrival: this.fb.nonNullable.control(false),
    arrivalLocation: this.fb.nonNullable.control(''),
  });

  readonly step2Form = this.fb.group({
    startDate: this.fb.nonNullable.control(''),
    endDate: this.fb.nonNullable.control(''),
    aiDates: this.fb.nonNullable.control(false),
    travelers: this.fb.nonNullable.control(2),
    cityDays: this.fb.array<FormControl<any>>([]),
  }, { validators: [this.dateRangeValidator.bind(this)] });

  private dateRangeValidator(group: import('@angular/forms').AbstractControl): import('@angular/forms').ValidationErrors | null {
    const start = group.get('startDate')?.value;
    const end = group.get('endDate')?.value;
    if (!start || !end) return null;

    const startDate = new Date(start);
    const endDate = new Date(end);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const errors: any = {};
    if (startDate < today) errors.pastStartDate = true;
    if (endDate < startDate) errors.endDateBeforeStart = true;
    return Object.keys(errors).length ? errors : null;
  }

  getTotalDays(): number {
    const start = this.step2Form.value.startDate;
    const end = this.step2Form.value.endDate;
    if (!start || !end) return 0;
    const diff = new Date(end).getTime() - new Date(start).getTime();
    return Math.max(1, Math.ceil(diff / (1000 * 3600 * 24)));
  }

  get destinationsArray() {
    return this.step1Form.get('destinations') as FormArray<FormControl<string>>;
  }

  get cityDaysFormArray() {
    return this.step2Form.get('cityDays') as FormArray;
  }

  ngOnInit(): void {
    // Populate form with store state
    const currentDestinations = this.destinations();
    if (currentDestinations.length > 0) {
      this.destinationsArray.clear();
      currentDestinations.forEach(d => this.destinationsArray.push(this.fb.nonNullable.control(d, Validators.required)));
    }

    this.step1Form.patchValue({
      departureLocation: this.departureLocation(),
      differentArrival: this.differentArrival(),
      arrivalLocation: this.arrivalLocation(),
    });

    const checkArrivalValidators = (different: boolean) => {
      const arrLocControl = this.step1Form.get('arrivalLocation');
      if (different) {
        arrLocControl?.setValidators([Validators.required]);
      } else {
        arrLocControl?.clearValidators();
      }
      arrLocControl?.updateValueAndValidity();
    };

    checkArrivalValidators(this.differentArrival());

    this.step1Form.get('differentArrival')?.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((val) => {
      checkArrivalValidators(val);
    });

    // Populate step 2
    this.step2Form.patchValue({
      startDate: this.summary().startDate,
      endDate: this.summary().endDate,
      aiDates: this.aiDates(),
      travelers: this.summary().travelers,
    });

    this.prefillFromIdentityPreferences();
  }

  /**
   * Pre-fill budget + food preferences from the customer's saved travel
   * preferences (GET /me/preferences) — but only on a genuinely fresh wizard
   * (no persisted draft, nothing picked yet this session), so we never
   * clobber a choice the user already made in this flow.
   */
  private prefillFromIdentityPreferences(): void {
    if (!this.auth.isLoggedIn()) return;
    if (this.selectedFoodPrefs().length > 0) return;
    if (localStorage.getItem('travlplanr_wizard_draft')) return;

    const applyPrefs = () => {
      const prefs = this.profileService.preferences();

      const budgetMap: Record<string, BudgetTier> = {
        Budget: 'budget',
        Standard: 'mid',
        Luxury: 'luxury',
      };
      const mappedBudget = budgetMap[prefs.travelStyle];
      if (mappedBudget) {
        this.store.setBudget(mappedBudget);
      }

      const wizardFoodIds = new Set(['vegetarian', 'vegan', 'halal', 'jain', 'gluten_free']);
      for (const dietaryId of prefs.dietary) {
        const normalized = dietaryId.replace(/-/g, '_');
        if (wizardFoodIds.has(normalized)) {
          this.store.toggleFoodPreference(normalized);
        }
      }
    };

    if (this.profileService.preferencesLoaded()) {
      applyPrefs();
    } else {
      // ProfileService loads preferences on construction for logged-in users —
      // wait for that in-flight request instead of firing a duplicate one.
      const check = setInterval(() => {
        if (this.profileService.preferencesLoaded()) {
          clearInterval(check);
          applyPrefs();
        }
      }, 200);
      setTimeout(() => clearInterval(check), 5000);
    }
  }

  addDestination() {
    this.destinationsArray.push(this.fb.nonNullable.control('', Validators.required));
  }

  removeDestination(index: number) {
    if (this.destinationsArray.length > 1) {
      this.destinationsArray.removeAt(index);
    }
  }

  incrementCityDays(index: number) {
    const control = this.cityDaysFormArray.at(index).get('nights');
    if (control && control.value < 30) {
      control.setValue(control.value + 1);
    }
  }

  decrementCityDays(index: number) {
    const control = this.cityDaysFormArray.at(index).get('nights');
    if (control && control.value > 1) {
      control.setValue(control.value - 1);
    }
  }

  getStepIcon(): string {
    switch (this.step()) {
      case 1: return 'plane';
      case 2: return 'calendar-3';
      case 3: return 'passport';
      case 4: return 'driving';
      case 5: return 'money-bag';
      case 6: return 'trip';
      default: return 'plane';
    }
  }

  canProceed(): boolean {
    if (this.step() === 1) {
      return this.step1Form.valid && this.destinationsArray.length > 0;
    }
    if (this.step() === 2) {
      const travelers = this.step2Form.value.travelers;
      const isTravelersValid = travelers !== null && travelers !== undefined && travelers >= 1 && travelers <= 20;
      if (!isTravelersValid) return false;

      if (this.step2Form.value.aiDates) {
        return this.cityDaysFormArray.valid;
      }
      const start = this.step2Form.value.startDate;
      const end = this.step2Form.value.endDate;
      if (!start || !end) return false;

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const startD = new Date(start);
      startD.setHours(0, 0, 0, 0);
      const endD = new Date(end);
      endD.setHours(0, 0, 0, 0);
      
      if (startD.getTime() < today.getTime()) return false;
      if (startD.getTime() > endD.getTime()) return false;

      return this.cityDaysFormArray.valid;
    }
    if (this.step() === 3) {
      return !!this.selectedStyle() && !!this.selectedMethod();
    }
    if (this.step() === 4) {
      return this.selectedInterests().length > 0;
    }
    if (this.step() === 5) {
      return !!this.selectedBudget();
    }
    return true;
  }

  next(): void {
    if (!this.canProceed()) return;
    
    if (this.step() === 1) {
      this.store.setDestinations(this.step1Form.value.destinations as string[]);
      this.store.setDepartureInfo(
        this.step1Form.value.departureLocation!,
        this.step1Form.value.differentArrival!,
        this.step1Form.value.arrivalLocation!
      );
    } else if (this.step() === 2) {
      this.store.setDates(
        this.step2Form.value.startDate || '',
        this.step2Form.value.endDate || '',
        this.step2Form.value.aiDates || false,
        this.step2Form.value.cityDays as { city: string; nights: number }[]
      );
      this.store.setTravelers(this.step2Form.value.travelers!);
    }
    this.store.nextStep();
  }

  prev(): void {
    if (this.step() === 1) {
      this.router.navigate(['/explore']);
    } else {
      this.store.prevStep();
    }
  }

  selectStyle(style: TravelStyle): void {
    this.store.setTravelStyle(style);
    const travelers = this.travelersForStyle(style);
    this.step2Form.patchValue({ travelers });
    this.store.setTravelers(travelers);
  }

  adjustTravelers(delta: number): void {
    const current = this.travelersCount;
    const newVal = Math.max(1, Math.min(20, current + delta));
    this.step2Form.patchValue({ travelers: newVal });
    this.store.setTravelers(newVal);
  }

  get travelersCount(): number {
    return this.step2Form.get('travelers')?.value ?? 2;
  }

  getInterestLabel(id: string): string {
    return this.interests.find((i) => i.id === id)?.label ?? id;
  }

  getBudgetLabel(id: BudgetTier | null | undefined): string {
    return this.budgets.find((b) => b.id === id)?.label ?? '';
  }

  getFoodPrefLabel(id: string): string {
    return this.foodPrefs.find((f) => f.id === id)?.label ?? id;
  }

  getMethodLabel(method: 'rental_car' | 'cab_taxi' | null | undefined): string {
    if (method === 'rental_car') return 'WIZARD.STEP3.RENTAL_CARS';
    if (method === 'cab_taxi') return 'WIZARD.STEP3.CAB_TAXI';
    return '';
  }

  travelersForStyle(style: TravelStyle): number {
    switch (style) {
      case 'solo': return 1;
      case 'couple': return 2;
      case 'family': return 4;
      case 'friends': return 2;
      default: return 2;
    }
  }

  selectMethod(method: 'rental_car' | 'cab_taxi'): void {
    this.store.setTravelMethod(method);
  }

  selectBudget(budget: BudgetTier): void {
    this.store.setBudget(budget);
  }

  toggleInterest(interest: string): void {
    this.store.toggleInterest(interest);
  }

  toggleFoodPref(foodPreference: string): void {
    this.store.toggleFoodPreference(foodPreference);
  }

  async generate(): Promise<void> {
    this.store.startGeneration();
    try {
      const tripId = await this.tripService.createFromWizard({
        destinations: this.step1Form.value.destinations as string[],
        startDate: this.step2Form.value.startDate || '',
        endDate: this.step2Form.value.endDate || '',
        aiDates: this.step2Form.value.aiDates || false,
        cityDays: this.step2Form.value.cityDays as { city: string; nights: number }[],
        travelers: this.travelersForStyle(this.selectedStyle()),
        travelStyle: this.selectedStyle(),
        travelMethod: this.selectedMethod()!,
        budget: this.selectedBudget(),
        interests: this.selectedInterests(),
        foodPreferences: this.selectedFoodPrefs(),
        departureLocation: this.departureLocation(),
        arrivalLocation: this.arrivalLocation(),
      });
      
      const POLL_TIMEOUT_MS = 120_000; // 2 minutes
      let p = 0;
      interval(1000)
        .pipe(
          switchMap(() => this.tripService.getTripFromBackend(tripId)),
          takeWhile(trip => trip !== undefined && trip.status !== 'ready' && trip.status !== 'failed', true),
          takeUntil(timer(POLL_TIMEOUT_MS)),
          takeUntilDestroyed(this.destroyRef),
          catchError(err => {
            console.error('Polling error', err);
            return of(undefined);
          })
        )
        .subscribe({
          next: (trip) => {
             if (p < 90) {
                 p += 10;
                 this.store.setGenerationProgress(p);
             }
             if (trip && trip.status === 'ready' && (trip.segments?.length ?? 0) > 0) {
                if (this.auth.isLoggedIn()) {
                  this.auth.incrementPlansUsed();
                }
                this.store.setGenerationProgress(100);
                this.store.completeGeneration(tripId);
                this.router.navigate(['/itinerary', tripId]);
             } else if (trip && trip.status === 'failed') {
                // AI failed — backend applies a local fallback; keep polling briefly.
                this.store.setGenerationProgress(Math.min(p + 5, 95));
             }
          },
          error: (err) => {
             console.error('Polling failed', err);
             this.store.failGeneration();
             this.toast.error(this.translate.instant('WIZARD.GENERATION_ERROR'));
          },
          complete: () => {
            this.tripService.getTripFromBackend(tripId).then(async trip => {
              if (trip && trip.status === 'ready' && (trip.segments?.length ?? 0) > 0) {
                if (this.auth.isLoggedIn()) {
                  this.auth.incrementPlansUsed();
                }
                this.store.setGenerationProgress(100);
                this.store.completeGeneration(tripId);
                this.router.navigate(['/itinerary', tripId]);
                return;
              }

              const rebuilt = await this.tripService.rebuildTrip(tripId);
              if (rebuilt && (rebuilt.segments?.length ?? 0) > 0) {
                if (this.auth.isLoggedIn()) {
                  this.auth.incrementPlansUsed();
                }
                this.store.setGenerationProgress(100);
                this.store.completeGeneration(tripId);
                this.router.navigate(['/itinerary', tripId]);
                return;
              }

              this.store.failGeneration();
              this.toast.error(this.translate.instant('WIZARD.GENERATION_TIMEOUT'));
            });
          }
        });
    } catch (err) {
       console.error('Failed to create trip', err);
       this.store.failGeneration();
       this.toast.error(this.translate.instant('WIZARD.CREATE_TRIP_ERROR'));
    }
  }
}
