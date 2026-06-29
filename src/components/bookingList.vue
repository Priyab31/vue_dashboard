<template>
  <div class="dashboard">
    <div class="notification-icon">
      <i class="fa fa-bell"></i>
    </div>
    <div class="profile">
      <span class="profile-name">William Dawson</span>
      <img
        src="../../static/images/profile.jpg"
        alt="Profile Picture"
        class="profile-pic"
      />
    </div>
    <div class="booking-list">
      <img
        src="../../static/images/bookingImage.jpg"
        alt="Booking Image"
        style="margin: 20px"
      />

      <div class="header-container">
        <h3 class="left-header">Booking List</h3>
        <h3 class="right-header">...</h3>
      </div>
      <ul>
        <li
          v-for="(booking, index) in bookings"
          :key="index"
          class="booking-item"
        >
          <img
            :src="getImageUrl(booking.profilePic)"
            alt="Profile Picture"
            class="booking-pic"
          />
          <div class="booking-details">
            <div class="left-details">
              <span class="booking-name">{{ booking.name }}</span>
              <span class="booking-guest">{{ booking.guest }}</span>
            </div>
            <div class="right-details">
              <span class="booking-date">{{ booking.date }}</span>
              <span
                :class="{
                  'booking-status': true,
                  'paid-status': booking.paid,
                  'pending-status': !booking.paid,
                }"
              >
                {{ booking.paid ? 'Paid' : 'Pending' }}
              </span>
            </div>
          </div>
        </li>
      </ul>
      <p style="color: blue">view all</p>
    </div>
  </div>
</template>

<script>
export default {
  name: 'DashboardComponent',
  data() {
    return {
      bookings: [
        {
          profilePic: 'profile3.jpg',
          name: 'Alice Smith',
          guest: '#SGL . 0 guests',
          date: '01.12-01.14',
          paid: true,
        },
        {
          profilePic: 'profile1.jpg',
          name: 'Bob Johnson',
          guest: '#QDPL . 3 guests',
          date: '01.12-01.13',
          paid: false,
        },
        {
          profilePic: 'profile2.jpg',
          name: 'Eva Williams',
          guest: 'DBL . 1 guest',
          date: '01.12-01.15',
          paid: true,
        },
        {
          profilePic: 'profile3.jpg',
          name: 'Eva',
          guest: 'DBL . 1 guest',
          date: '03.12-01.15',
          paid: true,
        },
      ], // bookings array
    };
  },
  methods: {
    getImageUrl(profilePic) {
      return require('../../static/images/' + profilePic); //return image url
    },
  },
};
</script>

<style scoped>
.dashboard {
  display: flex;
  flex-direction: column;
  background-color: transparent;
  padding: 20px;
  margin: 20px;
}

.notification-icon {
  position: absolute;
  font-size: 20px;
  color: #555;
  margin-top: 30px;
}

.profile {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  margin-top: 20px;
}

.profile-pic {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  margin-right: 10px;
}

.profile-name {
  color: #333;
  padding-right: 10px;
  font-weight: bold;
}

.booking-list {
  margin-top: 30px;
  background-color: white;
  border: 1px solid lightgray;
  border-radius: 30px;
  height: -webkit-fill-available;
  width: fit-content;
  padding: 20px;
}

.booking-list h3 {
  color: #555;
}

.booking-list ul {
  list-style: none;
  padding: 0;
  margin-top: 10px;
}

.booking-list li {
  padding: 15px 0;
  color: #444;
}

.booking-item {
  display: flex;
  align-items: center;
  padding: 10px 0;
  border-bottom: 1px solid #ccc;
}

.booking-pic {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  margin-right: 10px;
}

.booking-details {
  flex: 1;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.booking-name {
  margin-right: 10px;
  color: #444;
  font-size: smaller;
  font-weight: bold;
  padding-bottom: 10px;
}

.booking-status {
  color: #555;
}

.left-details {
  display: flex;
  flex-direction: column;
  flex-grow: 1;
  align-items: self-start;
  padding-left: 30px;
}

.right-details {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.booking-guest,
.booking-date,
.booking-status {
  margin: 2px 0;
  color: lightgrey;
  font-size: small;
}

.header-container {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.paid-status {
  background-color: #e2cbfd;
  color: darkmagenta;
  padding: 5px;
  border-radius: 50px;
  width: 50px;
}
.pending-status {
  background-color: #fff5ee;
  color: orange;
  padding: 5px;
  border-radius: 50px;
  width: -webkit-fill-available;
}
</style>
