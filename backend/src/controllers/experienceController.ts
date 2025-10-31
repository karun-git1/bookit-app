import { Request, Response } from 'express';
import pool from '../config/database';

export const getExperiences = async (req: Request, res: Response): Promise<void> => {
  try {
    const [experiences] = await pool.execute(
      'SELECT * FROM experiences ORDER BY created_at DESC'
    );
    
    res.json({
      success: true,
      data: experiences,
      message: 'Experiences fetched successfully'
    });
  } catch (error) {
    console.error('Error fetching experiences:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

export const getExperienceById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    
    const [experiences] = await pool.execute(
      'SELECT * FROM experiences WHERE id = ?',
      [id]
    );
    
    const experienceArray = experiences as any[];
    
    if (experienceArray.length === 0) {
      res.status(404).json({
        success: false,
        message: 'Experience not found'
      });
      return;
    }

    const experience = experienceArray[0];

    // Get available slots for this experience
    const [slots] = await pool.execute(
      `SELECT * FROM slots 
       WHERE experience_id = ? AND date >= CURDATE() AND available_spots > 0 
       ORDER BY date, start_time`,
      [id]
    );

    res.json({
      success: true,
      data: {
        ...experience,
        slots
      },
      message: 'Experience details fetched successfully'
    });
  } catch (error) {
    console.error('Error fetching experience:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};
