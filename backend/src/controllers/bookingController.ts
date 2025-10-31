import { Request, Response } from 'express';
import pool from '../config/database';
import { bookingSchema } from '../validation/schemas';

const generateBookingReference = (): string => {
  return 'BK' + Date.now() + Math.random().toString(36).substr(2, 5).toUpperCase();
};

export const createBooking = async (req: Request, res: Response): Promise<void> => {
  try {
    const { error, value } = bookingSchema.validate(req.body);
    
    if (error) {
      res.status(400).json({
        success: false,
        message: error.details[0].message
      });
      return;
    }

    const bookingData = value;
    const connection = await pool.getConnection();
    
    try {
      await connection.beginTransaction();

      // Check slot availability
      const [slots] = await connection.execute(
        'SELECT * FROM slots WHERE id = ? AND available_spots >= ? FOR UPDATE',
        [bookingData.slot_id, bookingData.number_of_people]
      );

      const slotArray = slots as any[];
      
      if (slotArray.length === 0) {
        await connection.rollback();
        res.status(400).json({
          success: false,
          message: 'Slot not available or insufficient spots'
        });
        return;
      }

      const slot = slotArray[0];

      // Calculate total amount
      const [experiences] = await connection.execute(
        'SELECT price FROM experiences WHERE id = ?',
        [slot.experience_id]
      );
      
      const experienceArray = experiences as any[];
      const experience = experienceArray[0];
      let totalAmount = experience.price * bookingData.number_of_people;
      let discountAmount = 0;
      let finalAmount = totalAmount;

      // Apply promo code if provided
      if (bookingData.promo_code) {
        const [promos] = await connection.execute(
          `SELECT * FROM promo_codes 
           WHERE code = ? AND is_active = true 
           AND valid_from <= CURDATE() AND valid_until >= CURDATE() 
           AND (usage_limit IS NULL OR used_count < usage_limit)`,
          [bookingData.promo_code]
        );

        const promoArray = promos as any[];
        const promo = promoArray[0];
        
        if (promo && totalAmount >= promo.min_amount) {
          if (promo.discount_type === 'percentage') {
            discountAmount = (totalAmount * promo.discount_value) / 100;
            if (promo.max_discount && discountAmount > promo.max_discount) {
              discountAmount = promo.max_discount;
            }
          } else {
            discountAmount = promo.discount_value;
          }
          
          finalAmount = totalAmount - discountAmount;
          
          // Update promo code usage
          await connection.execute(
            'UPDATE promo_codes SET used_count = used_count + 1 WHERE code = ?',
            [bookingData.promo_code]
          );
        }
      }

      // Update available spots
      await connection.execute(
        'UPDATE slots SET available_spots = available_spots - ? WHERE id = ?',
        [bookingData.number_of_people, bookingData.slot_id]
      );

      // Create booking
      const bookingReference = generateBookingReference();
      
      await connection.execute(
        `INSERT INTO bookings 
         (slot_id, user_name, user_email, user_phone, number_of_people, 
          total_amount, discount_amount, final_amount, promo_code, booking_reference) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          bookingData.slot_id,
          bookingData.user_name,
          bookingData.user_email,
          bookingData.user_phone || null,
          bookingData.number_of_people,
          totalAmount,
          discountAmount,
          finalAmount,
          bookingData.promo_code || null,
          bookingReference
        ]
      );

      await connection.commit();

      res.status(201).json({
        success: true,
        data: {
          booking_reference: bookingReference,
          final_amount: finalAmount,
          discount_amount: discountAmount,
          total_amount: totalAmount
        },
        message: 'Booking created successfully'
      });

    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }

  } catch (error) {
    console.error('Error creating booking:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};
