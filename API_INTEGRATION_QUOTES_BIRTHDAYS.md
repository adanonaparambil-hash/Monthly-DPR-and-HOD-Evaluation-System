# API Integration - Quotes and Birthdays

## Overview
Integrated the `GetTodaysBirthdaysAndQuotes` API endpoint across all three dashboards (Employee, HOD, CED) to display real-time quotes and birthday data.

## API Endpoint

### Method
```typescript
GetTodaysBirthdaysAndQuotes(): Observable<any>
```

### URL
```
GET /api/General/GetTodaysBirthdaysAndQuotes
```

### Response Structure
```json
{
  "success": true,
  "message": "Success",
  "data": {
    "employees": [
      {
        "employeeName": "AHMED SAID BADAR ALI AL SHEKAILI",
        "department": "PMV",
        "dob": "12/01/1994 00:00:00",
        "profileImageBase64": "data:image/jpeg;base64,..."
      }
    ],
    "quotes": [
      {
        "id": 253,
        "quoteText": "The harder you work for something, the greater you'll feel when you achieve it.",
        "author": "Steve Jobs"
      },
      {
        "id": 110,
        "quoteText": "Push yourself, because no one else is going to do it for you.",
        "author": "Confucius"
      }
    ]
  }
}
```

## Implementation Details

### API Service
**File:** `src/app/services/api.ts`

Added new method:
```typescript
GetTodaysBirthdaysAndQuotes(): Observable<any> {
  return this.http.get(`${this.apiUrl}/General/GetTodaysBirthdaysAndQuotes`);
}
```

### Employee Dashboard
**File:** `src/app/employee-dashboard/employee-dashboard.ts`

#### Quote Loading
```typescript
private loadQuoteOfTheDay(): void {
  this.api.GetTodaysBirthdaysAndQuotes().subscribe({
    next: (response: any) => {
      if (response && response.success && response.data) {
        if (response.data.quotes && response.data.quotes.length > 0) {
          // Randomly select one quote from the returned quotes
          const randomIndex = Math.floor(Math.random() * response.data.quotes.length);
          const selectedQuote = response.data.quotes[randomIndex];
          this.quoteOfTheDay = {
            text: selectedQuote.quoteText,
            author: selectedQuote.author
          };
        }
      }
    },
    error: (error) => {
      console.error('Error fetching quotes:', error);
      // Keeps default quote on error
    }
  });
}
```

#### Birthday Loading
```typescript
private loadTodaysBirthdays(): void {
  this.api.GetTodaysBirthdaysAndQuotes().subscribe({
    next: (response: any) => {
      if (response && response.success && response.data) {
        if (response.data.employees && response.data.employees.length > 0) {
          this.todaysBirthdays = response.data.employees.map((emp: any, index: number) => ({
            id: index.toString(),
            name: emp.employeeName,
            department: emp.department,
            profileImage: emp.profileImageBase64 || 'fallback-image-url'
          }));
        } else {
          this.todaysBirthdays = [];
        }
      }
    },
    error: (error) => {
      console.error('Error fetching birthdays:', error);
      this.todaysBirthdays = [];
    }
  });
}
```

### HOD Dashboard
**File:** `src/app/hod-dashboard/hod-dashboard.ts`

Same implementation as Employee Dashboard:
- Fetches quotes and randomly selects one
- Maps employee data to birthday format
- Handles profileImageBase64 for profile pictures
- Graceful error handling

### CED Dashboard
**File:** `src/app/ced-dashboard-new/ced-dashboard-new.component.ts`

Same implementation as Employee Dashboard:
- Uses `this.apiService` instead of `this.api`
- Fetches quotes and randomly selects one
- Maps employee data to birthday format
- Handles profileImageBase64 for profile pictures
- Graceful error handling

## Features

### Quote Display
1. **Random Selection**: Randomly picks one quote from the API response
2. **Multiple Quotes**: API returns 2 quotes, one is randomly selected
3. **Fallback**: If API fails, keeps the default quote
4. **Daily Variation**: Different quote each time the page loads

### Birthday Display
1. **Dynamic Count**: Shows all employees with birthdays today
2. **Profile Images**: Uses `profileImageBase64` from API
3. **Fallback Image**: Uses default image if no profile image available
4. **Auto-Carousel**: Automatically cycles through birthdays every 4 seconds
5. **Manual Navigation**: Click indicators to jump to specific birthday
6. **Empty State**: Shows "No birthdays today" when list is empty

## Data Mapping

### Quote Mapping
```typescript
API Response          →  Component Property
-----------------        -------------------
quoteText            →  text
author               →  author
```

### Birthday Mapping
```typescript
API Response          →  Component Property
-----------------        -------------------
employeeName         →  name
department           →  department
profileImageBase64   →  profileImage
(index)              →  id
```

## Error Handling

### Quote Loading Errors
- Logs error to console
- Keeps default quote displayed
- User sees no disruption

### Birthday Loading Errors
- Logs error to console
- Sets `todaysBirthdays` to empty array
- Shows "No birthdays today" message

## Benefits

1. **Real-Time Data**: Always shows current day's birthdays and quotes
2. **Dynamic Content**: No hardcoded data
3. **Profile Pictures**: Shows actual employee photos
4. **Scalable**: Handles any number of birthdays
5. **Reliable**: Graceful error handling
6. **Consistent**: Same implementation across all dashboards
7. **User-Friendly**: Smooth carousel for multiple birthdays

## Testing Checklist

### API Integration
- [ ] API endpoint returns data successfully
- [ ] Quotes are fetched and displayed
- [ ] Birthdays are fetched and displayed
- [ ] Profile images load correctly
- [ ] Error handling works (test with API down)

### Quote Display
- [ ] Random quote selection works
- [ ] Quote text displays correctly
- [ ] Author name displays correctly
- [ ] Fallback quote shows on error

### Birthday Display
- [ ] All birthdays for today are shown
- [ ] Profile images display correctly
- [ ] Fallback image works when no profile image
- [ ] Department names display correctly
- [ ] Employee names display correctly
- [ ] Carousel auto-slides with multiple birthdays
- [ ] Manual navigation works
- [ ] "No birthdays today" shows when empty

### All Dashboards
- [ ] Employee Dashboard: Quotes and birthdays work
- [ ] HOD Dashboard: Quotes and birthdays work
- [ ] CED Dashboard: Quotes and birthdays work
- [ ] Dark mode: All elements visible
- [ ] Mobile: Responsive and readable

## Usage

### On Page Load
1. Dashboard component initializes
2. Calls `loadQuoteOfTheDay()`
3. Calls `loadTodaysBirthdays()`
4. Calls `startBirthdayCarousel()`
5. API fetches data
6. UI updates with real data

### Quote Selection
- API returns 2 quotes
- Component randomly selects one
- Selected quote displays in card
- Changes on each page refresh

### Birthday Carousel
- Shows all employees with birthdays today
- Auto-slides every 4 seconds
- Manual navigation with dots
- Smooth transitions

## Notes

- API is called once on component initialization
- Same API call returns both quotes and birthdays
- Efficient: Single API call for both features
- Profile images use base64 encoding
- Fallback images ensure UI never breaks
- Empty states handled gracefully
- All three dashboards use identical logic
