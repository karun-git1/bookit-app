import { Request, Response } from 'express';
import pool from '../config/database';
import { promoValidationSchema } from '../validation/schemas';

export const validatePromoCode = async (req: Request, res: Response): Promise<void> => {
  try {
    const { error, value } = promoValidationSchema.validate(req.body);
    
    if (error) {
      res.status(400).json({
        success: false,
        message: error.details[0].message
      });
      return;
    }

    const { code, total_amount } = value;

    const [promos] = await pool.execute(
      `SELECT * FROM promo_codes 
       WHERE code = ? AND is_active = true 
       AND valid_from <= CURDATE() AND valid_until >= CURDATE() 
       AND (usage_limit IS NULL OR used_count < usage_limit)`,
      [code]
    );

    const promoArray = promos as any[];
    const promo = promoArray[0];

    if (!promo) {
      res.json({
        success: false,
        message: 'Invalid or expired promo code'
      });
      return;
    }

    if (total_amount < promo.min_amount) {
      res.json({
        success: false,
        message: `Minimum amount of $${promo.min_amount} required for this promo code`
      });
      return;
    }

    let discount_amount = 0;
    
    if (promo.discount_type === 'percentage') {
      discount_amount = (total_amount * promo.discount_value) / 100;
      if (promo.max_discount && discount_amount > promo.max_discount) {
        discount_amount = promo.max_discount;
      }
    } else {
      discount_amount = promo.discount_value;
    }

    const final_amount = total_amount - discount_amount;

    res.json({
      success: true,
      data: {
        valid: true,
        discount_amount,
        final_amount,
        promo_code: promo.code,
        discount_type: promo.discount_type,
        discount_value: promo.discount_value
      },
      message: 'Promo code applied successfully'
    });

  } catch (error) {
    console.error('Error validating promo code:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};
