import { Router } from 'express';
import {
  getExperiences,
  getExperienceById
} from '../controllers/experienceController';
import { createBooking } from '../controllers/bookingController';
import { validatePromoCode } from '../controllers/promoController';

const router = Router();

// Experience routes
router.get('/experiences', getExperiences);
router.get('/experiences/:id', getExperienceById);

// Booking routes
router.post('/bookings', createBooking);

// Promo code routes
router.post('/promo/validate', validatePromoCode);

export default router;
